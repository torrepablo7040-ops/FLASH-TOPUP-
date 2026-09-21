"""Regression tests for POST /api/orders (ObjectId serialization) + admin approve/complete flow."""
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
# fallback to reading /app/frontend/.env
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL"):
                BASE_URL = line.split("=", 1)[1].strip().strip('"').rstrip("/")

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

CUSTOMER_EMAIL = "verify@test.com"
CUSTOMER_ID = "cv1"
CUSTOMER_TOKEN = "vtok1"
ADMIN_EMAIL = "torrepablo7040@gmail.com"
ADMIN_TOKEN = "vadmintok1"


@pytest.fixture(scope="module")
def mongo():
    client = MongoClient(MONGO_URL)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def seed(mongo):
    now = datetime.now(timezone.utc)
    expires = (now + timedelta(days=7)).isoformat()

    # customer + session
    mongo.customers.update_one(
        {"email": CUSTOMER_EMAIL},
        {"$set": {"id": CUSTOMER_ID, "email": CUSTOMER_EMAIL, "name": "Verify",
                  "loyalty_points": 0, "is_reseller": False,
                  "created_at": now.isoformat()}},
        upsert=True,
    )
    mongo.customer_sessions.update_one(
        {"session_token": CUSTOMER_TOKEN},
        {"$set": {"session_token": CUSTOMER_TOKEN, "email": CUSTOMER_EMAIL,
                  "expires_at": expires, "created_at": now.isoformat()}},
        upsert=True,
    )
    # admin session
    mongo.admin_sessions.update_one(
        {"session_token": ADMIN_TOKEN},
        {"$set": {"session_token": ADMIN_TOKEN, "email": ADMIN_EMAIL,
                  "expires_at": expires, "created_at": now.isoformat()}},
        upsert=True,
    )
    # Product
    product = mongo.products.find_one({"available": True}, {"_id": 0})
    assert product, "No available product to test with"

    # cleanup any prior test orders
    mongo.orders.delete_many({"customer_email": CUSTOMER_EMAIL})

    yield {"product": product}

    # teardown
    mongo.orders.delete_many({"customer_email": CUSTOMER_EMAIL})
    mongo.customer_sessions.delete_one({"session_token": CUSTOMER_TOKEN})
    mongo.admin_sessions.delete_one({"session_token": ADMIN_TOKEN})
    mongo.customers.delete_one({"email": CUSTOMER_EMAIL})


@pytest.fixture
def customer_headers():
    return {"Authorization": f"Bearer {CUSTOMER_TOKEN}", "Content-Type": "application/json"}


@pytest.fixture
def admin_headers():
    return {"Authorization": f"Bearer {ADMIN_TOKEN}", "Content-Type": "application/json"}


def _order_payload(product_id, txn_id):
    return {
        "product_id": product_id,
        "quantity": 2,
        "customer_name": "Verify User",
        "customer_phone": "+50912345678",
        "game_id": "GAME123",
        "delivery_info": "test",
        "payment_method": "moncash",
        "proof_image_url": "https://example.com/proof.png",
        "transaction_id": txn_id,
    }


class TestOrderRegression:
    txn_id = f"TESTTXN{uuid.uuid4().hex[:8].upper()}"
    created = {}

    def test_01_post_orders_no_auth(self, seed):
        r = requests.post(f"{BASE_URL}/api/orders",
                          json=_order_payload(seed["product"]["id"], "SHOULDFAIL"))
        assert r.status_code == 401, f"expected 401 got {r.status_code}: {r.text}"

    def test_02_post_orders_success(self, seed, customer_headers, mongo):
        product = seed["product"]
        payload = _order_payload(product["id"], TestOrderRegression.txn_id)
        r = requests.post(f"{BASE_URL}/api/orders", headers=customer_headers, json=payload)
        assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text}"
        data = r.json()
        # No ObjectId leak
        assert "_id" not in data
        # order_number format FT-XXXX
        assert data["order_number"].startswith("FT-"), data["order_number"]
        assert data["status"] == "pending"
        # margin fetched from DB settings (default 10%, may differ)
        settings = mongo.settings.find_one({}, {"_id": 0}) or {}
        margin = float(settings.get("margin_percent", 10.0))
        expected_unit = round(product["base_price"] * (1 + margin / 100), 2)
        expected_total = round(expected_unit * 2, 2)
        assert data["unit_price"] == expected_unit
        assert data["total_amount"] == expected_total
        assert data["customer_email"] == CUSTOMER_EMAIL
        assert data["transaction_id"] == TestOrderRegression.txn_id
        TestOrderRegression.created = data

    def test_03_post_orders_duplicate_transaction_409(self, seed, customer_headers):
        payload = _order_payload(seed["product"]["id"], TestOrderRegression.txn_id)
        r = requests.post(f"{BASE_URL}/api/orders", headers=customer_headers, json=payload)
        assert r.status_code == 409, f"expected 409 got {r.status_code}: {r.text}"

    def test_04_get_customer_orders_contains_order(self, customer_headers):
        r = requests.get(f"{BASE_URL}/api/customer/orders", headers=customer_headers)
        assert r.status_code == 200
        orders = r.json()
        order_ids = [o["id"] for o in orders]
        assert TestOrderRegression.created["id"] in order_ids
        # verify status = pending
        this_order = next(o for o in orders if o["id"] == TestOrderRegression.created["id"])
        assert this_order["status"] == "pending"

    def test_05_admin_approve(self, admin_headers):
        oid = TestOrderRegression.created["id"]
        r = requests.post(f"{BASE_URL}/api/admin/orders/{oid}/approve", headers=admin_headers)
        assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text}"

    def test_06_customer_orders_reflects_approved(self, customer_headers):
        r = requests.get(f"{BASE_URL}/api/customer/orders", headers=customer_headers)
        assert r.status_code == 200
        oid = TestOrderRegression.created["id"]
        found = next(o for o in r.json() if o["id"] == oid)
        assert found["status"] == "approved"

    def test_07_admin_complete(self, admin_headers):
        oid = TestOrderRegression.created["id"]
        r = requests.post(f"{BASE_URL}/api/admin/orders/{oid}/complete", headers=admin_headers)
        assert r.status_code == 200, f"expected 200 got {r.status_code}: {r.text}"

    def test_08_customer_orders_reflects_completed(self, customer_headers):
        r = requests.get(f"{BASE_URL}/api/customer/orders", headers=customer_headers)
        assert r.status_code == 200
        oid = TestOrderRegression.created["id"]
        found = next(o for o in r.json() if o["id"] == oid)
        assert found["status"] == "completed"

    def test_09_admin_logs_contain_actions(self, admin_headers):
        r = requests.get(f"{BASE_URL}/api/admin/logs", headers=admin_headers)
        assert r.status_code == 200
        logs = r.json()
        order_num = TestOrderRegression.created["order_number"]
        actions_for_order = [l for l in logs if l.get("target") == order_num or order_num in str(l)]
        # look for approve + complete
        joined = " ".join(str(l) for l in actions_for_order)
        assert "approve" in joined, f"approve not found in logs: {actions_for_order[:5]}"
        assert "complete" in joined, f"complete not found in logs: {actions_for_order[:5]}"
