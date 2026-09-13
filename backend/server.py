from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Request, Response, Header, Cookie
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import requests
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

APP_NAME = os.environ.get('APP_NAME', 'flashtopup')
SUPER_ADMIN_EMAIL = os.environ.get('SUPER_ADMIN_EMAIL', '').strip().lower()
EMERGENT_KEY = os.environ.get('EMERGENT_LLM_KEY')
RESEND_API_KEY = os.environ.get('RESEND_API_KEY', '').strip()
STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ---------------------- Storage helpers ----------------------
storage_key = None

def init_storage(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key

def put_object(path: str, data: bytes, content_type: str) -> dict:
    key = init_storage()
    resp = requests.put(
        f"{STORAGE_URL}/objects/{path}",
        headers={"X-Storage-Key": key, "Content-Type": content_type},
        data=data, timeout=120
    )
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.put(
            f"{STORAGE_URL}/objects/{path}",
            headers={"X-Storage-Key": key, "Content-Type": content_type},
            data=data, timeout=120
        )
    resp.raise_for_status()
    return resp.json()

def get_object(path: str):
    key = init_storage()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = init_storage(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")

# ---------------------- Models ----------------------
def now_iso():
    return datetime.now(timezone.utc).isoformat()

class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str
    icon: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)

class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    image_url: str = ""
    base_price: float  # HTG before margin
    category_id: str
    available: bool = True
    created_at: str = Field(default_factory=now_iso)

class ProductIn(BaseModel):
    name: str
    description: str = ""
    image_url: str = ""
    base_price: float
    category_id: str
    available: bool = True

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    order_number: str
    product_id: str
    product_name: str
    unit_price: float  # customer price with margin
    quantity: int = 1
    total_amount: float
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    game_id: str  # ID game / player identifier
    delivery_info: str = ""  # extra info
    payment_method: str  # natcash / moncash
    payment_beneficiary_name: str
    payment_receiver_number: str
    proof_image_url: str
    transaction_id: str
    status: str = "pending"  # pending | approved | rejected | completed
    rejection_reason: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)

class OrderIn(BaseModel):
    product_id: str
    quantity: int = 1
    customer_name: str
    customer_phone: str
    customer_email: Optional[str] = None
    game_id: str
    delivery_info: str = ""
    payment_method: str
    proof_image_url: str
    transaction_id: str
    coupon_code: Optional[str] = None
    redeem_points: int = 0

class AdminUser(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    role: str = "admin"  # admin | super_admin
    created_at: str = Field(default_factory=now_iso)

class AdminIn(BaseModel):
    email: str
    role: str = "admin"

class Banner(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subtitle: str = ""
    image_url: str = ""
    link_url: str = ""
    active: bool = True
    order: int = 0

# ---------------------- Auth helpers ----------------------
async def current_admin(request: Request) -> AdminUser:
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Non authentifié")
    session = await db.admin_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session invalide")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expirée")
    admin = await db.admins.find_one({"email": session["email"]}, {"_id": 0})
    if not admin:
        raise HTTPException(status_code=403, detail="Accès refusé")
    return AdminUser(**admin)

async def require_super_admin(request: Request) -> AdminUser:
    admin = await current_admin(request)
    if admin.role != "super_admin":
        raise HTTPException(status_code=403, detail="Super Admin requis")
    return admin

# ---------- Customer auth ----------
class Customer(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    phone: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)

async def current_customer(request: Request) -> Customer:
    token = request.cookies.get("customer_session_token")
    if not token:
        auth = request.headers.get("authorization", "")
        if auth.lower().startswith("bearer "):
            token = auth.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Connexion client requise")
    session = await db.customer_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Session invalide")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expirée")
    c = await db.customers.find_one({"email": session["email"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=401, detail="Compte introuvable")
    return Customer(**c)

# ---------------------- Settings ----------------------
DEFAULT_SETTINGS = {
    "id": "singleton",
    "margin_percent": 10.0,
    "moncash_number": "",
    "moncash_beneficiary": "",
    "natcash_number": "",
    "natcash_beneficiary": "",
    "payment_instructions": "Envoyez le paiement au numéro affiché, puis uploadez une capture d'écran de la transaction et entrez l'ID de transaction.",
    "site_title": "FLASH-Topup",
    "site_tagline": "Recharge instantanée pour vos jeux préférés",
    "hero_heading": "FLASH-Topup — Rechargez à la vitesse de l'éclair ⚡",
    "hero_subheading": "DLS, eFootball, PUBG Mobile, Free Fire, FC Mobile, CapCut Pro. Paiement MonCash / NatCash. Livraison en 2-5 min.",
    "whatsapp_support": "",
    "updated_at": now_iso(),
}

async def get_settings():
    s = await db.settings.find_one({"id": "singleton"}, {"_id": 0})
    if not s:
        await db.settings.insert_one({**DEFAULT_SETTINGS})
        return dict(DEFAULT_SETTINGS)
    # backfill missing keys
    merged = {**DEFAULT_SETTINGS, **s}
    return merged

# ---------------------- Bootstrap ----------------------
@app.on_event("startup")
async def on_startup():
    try:
        if EMERGENT_KEY:
            init_storage()
            logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")
    # ensure super admin exists
    if SUPER_ADMIN_EMAIL:
        existing = await db.admins.find_one({"email": SUPER_ADMIN_EMAIL})
        if not existing:
            await db.admins.insert_one({
                **AdminUser(email=SUPER_ADMIN_EMAIL, role="super_admin", name="Super Admin").model_dump()
            })
            logger.info(f"Seeded super admin: {SUPER_ADMIN_EMAIL}")
    # ensure settings
    await get_settings()
    # seed default categories & sample products if empty
    count = await db.categories.count_documents({})
    if count == 0:
        cats = [
            {"name": "PUBG Mobile", "slug": "pubg", "icon": "gamepad-2"},
            {"name": "Free Fire", "slug": "freefire", "icon": "flame"},
            {"name": "eFootball", "slug": "efootball", "icon": "trophy"},
            {"name": "DLS", "slug": "dls", "icon": "goal"},
            {"name": "FC Mobile", "slug": "fcmobile", "icon": "shield"},
            {"name": "CapCut Pro", "slug": "capcut", "icon": "scissors"},
            {"name": "Autres", "slug": "autres", "icon": "sparkles"},
        ]
        for c in cats:
            await db.categories.insert_one({**Category(**c).model_dump()})

# ---------------------- Public routes ----------------------
@api_router.get("/")
async def root():
    return {"app": "FLASH-Topup", "status": "ok"}

@api_router.get("/settings/public")
async def public_settings():
    s = await get_settings()
    return {
        "margin_percent": s["margin_percent"],
        "moncash_number": s["moncash_number"],
        "moncash_beneficiary": s["moncash_beneficiary"],
        "natcash_number": s["natcash_number"],
        "natcash_beneficiary": s["natcash_beneficiary"],
        "payment_instructions": s["payment_instructions"],
        "site_title": s["site_title"],
        "site_tagline": s["site_tagline"],
        "hero_heading": s["hero_heading"],
        "hero_subheading": s["hero_subheading"],
        "whatsapp_support": s.get("whatsapp_support", ""),
    }

@api_router.get("/categories")
async def list_categories():
    cats = await db.categories.find({}, {"_id": 0}).to_list(1000)
    return cats

@api_router.get("/products")
async def list_products(category_id: Optional[str] = None, only_available: bool = False):
    q = {}
    if category_id:
        q["category_id"] = category_id
    if only_available:
        q["available"] = True
    products = await db.products.find(q, {"_id": 0}).to_list(1000)
    s = await get_settings()
    margin = float(s["margin_percent"])
    for p in products:
        p["price"] = round(float(p["base_price"]) * (1 + margin / 100), 2)
    return products

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Produit introuvable")
    s = await get_settings()
    p["price"] = round(float(p["base_price"]) * (1 + float(s["margin_percent"]) / 100), 2)
    return p

@api_router.get("/banners")
async def list_banners():
    banners = await db.banners.find({"active": True}, {"_id": 0}).sort("order", 1).to_list(100)
    return banners

# ---------------------- Uploads ----------------------
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, "Type de fichier non supporté")
    ext = (file.filename.split(".")[-1] if file.filename and "." in file.filename else "bin").lower()
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(400, "Fichier trop volumineux (max 5MB)")
    path = f"{APP_NAME}/uploads/{uuid.uuid4()}.{ext}"
    try:
        result = put_object(path, data, file.content_type)
    except Exception as e:
        logger.error(f"Upload failed: {e}")
        raise HTTPException(500, "Échec de l'upload")
    await db.files.insert_one({
        "id": str(uuid.uuid4()),
        "storage_path": result["path"],
        "content_type": file.content_type,
        "size": result.get("size", len(data)),
        "created_at": now_iso(),
    })
    return {"path": result["path"], "url": f"/api/files/{result['path']}"}

@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    record = await db.files.find_one({"storage_path": path}, {"_id": 0})
    if not record:
        raise HTTPException(404, "Fichier introuvable")
    try:
        data, ct = get_object(path)
    except Exception as e:
        logger.error(f"Get object failed: {e}")
        raise HTTPException(404, "Fichier introuvable")
    return Response(content=data, media_type=record.get("content_type", ct))

# ---------------------- Orders ----------------------
def gen_order_number():
    return "FT-" + uuid.uuid4().hex[:8].upper()

async def send_status_email(order: dict):
    if not RESEND_API_KEY or not order.get("customer_email"):
        return
    labels = {
        "pending": ("En attente", "Votre commande est en cours de vérification."),
        "approved": ("Approuvée ✅", "Votre paiement a été vérifié. Votre commande est approuvée."),
        "rejected": ("Rejetée ❌", f"Votre commande a été rejetée. Raison: {order.get('rejection_reason') or 'Non spécifiée'}"),
        "completed": ("Terminée 🎉", "Votre produit/service a été livré. Merci pour votre achat !"),
    }
    label, msg = labels.get(order["status"], (order["status"], ""))
    try:
        requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"},
            json={
                "from": "FLASH-Topup <onboarding@resend.dev>",
                "to": [order["customer_email"]],
                "subject": f"[FLASH-Topup] Commande {order['order_number']} — {label}",
                "html": f"<h2>Commande {order['order_number']}</h2><p>Statut: <b>{label}</b></p><p>{msg}</p><p>Produit: {order['product_name']}<br>Montant: {order['total_amount']} HTG</p>",
            },
            timeout=10,
        )
    except Exception as e:
        logger.error(f"Resend failed: {e}")

@api_router.post("/orders")
async def create_order(body: OrderIn, request: Request):
    # Client Google auth obligatoire pour toute commande
    customer = await current_customer(request)
    product = await db.products.find_one({"id": body.product_id}, {"_id": 0})
    if not product:
        raise HTTPException(404, "Produit introuvable")
    if not product.get("available", True):
        raise HTTPException(400, "Produit indisponible")
    if body.payment_method not in ("moncash", "natcash"):
        raise HTTPException(400, "Méthode de paiement invalide")
    s = await get_settings()
    unit_price = round(float(product["base_price"]) * (1 + float(s["margin_percent"]) / 100), 2)
    qty = max(1, int(body.quantity))
    subtotal = round(unit_price * qty, 2)
    total = subtotal
    discount = 0.0
    loyalty = await get_loyalty()
    # Reseller discount
    cust_doc = await db.customers.find_one({"email": customer.email}, {"_id": 0}) or {}
    if cust_doc.get("is_reseller"):
        discount += subtotal * float(loyalty["reseller_discount_percent"]) / 100
    # Coupon
    coupon = None
    if body.coupon_code:
        coupon = await db.coupons.find_one({"code": body.coupon_code.upper().strip(), "active": True}, {"_id": 0})
        if coupon:
            if coupon.get("max_uses", 0) > 0 and coupon.get("uses", 0) >= coupon["max_uses"]:
                raise HTTPException(400, "Coupon épuisé")
            discount += subtotal * float(coupon.get("discount_percent", 0)) / 100
            discount += float(coupon.get("discount_amount", 0))
    # Loyalty redeem
    redeem_amount = 0.0
    if loyalty.get("active") and body.redeem_points and body.redeem_points > 0:
        avail = cust_doc.get("loyalty_points", 0)
        pts = min(body.redeem_points, avail)
        if pts >= loyalty["min_redeem_points"]:
            redeem_amount = pts * float(loyalty["htg_per_point"])
            discount += redeem_amount
    total = max(0, round(subtotal - discount, 2))
    if body.payment_method == "moncash":
        ben_name = s["moncash_beneficiary"]
        ben_num = s["moncash_number"]
    else:
        ben_name = s["natcash_beneficiary"]
        ben_num = s["natcash_number"]
    order = Order(
        order_number=gen_order_number(),
        product_id=product["id"],
        product_name=product["name"],
        unit_price=unit_price,
        quantity=qty,
        total_amount=total,
        customer_name=body.customer_name.strip(),
        customer_phone=body.customer_phone.strip(),
        customer_email=customer.email,
        game_id=body.game_id.strip(),
        delivery_info=body.delivery_info.strip(),
        payment_method=body.payment_method,
        payment_beneficiary_name=ben_name,
        payment_receiver_number=ben_num,
        proof_image_url=body.proof_image_url,
        transaction_id=body.transaction_id.strip(),
    )
    # Anti-double: reject duplicate transaction_id within last 24h
    dup = await db.orders.find_one({"transaction_id": body.transaction_id.strip(), "payment_method": body.payment_method}, {"_id": 0})
    if dup:
        raise HTTPException(409, "Cet ID de transaction a déjà été utilisé pour une autre commande.")
    # Anti-spam: max 5 orders per customer / 10 min
    ten_min_ago = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    recent = await db.orders.count_documents({"customer_email": customer.email, "created_at": {"$gte": ten_min_ago}})
    if recent >= 5:
        raise HTTPException(429, "Trop de commandes récentes. Merci de patienter quelques minutes.")
    # Validation
    if len(body.transaction_id.strip()) < 4:
        raise HTTPException(400, "ID de transaction invalide (min 4 caractères)")
    if len(body.customer_phone.strip()) < 6:
        raise HTTPException(400, "Numéro de téléphone invalide")
    doc = order.model_dump()
    doc["customer_id"] = customer.id
    doc["subtotal"] = subtotal
    doc["discount"] = round(discount, 2)
    doc["coupon_code"] = coupon["code"] if coupon else None
    doc["redeemed_points"] = int(body.redeem_points) if redeem_amount > 0 else 0
    await db.orders.insert_one(doc)
    doc.pop("_id", None)
    # Apply loyalty & coupon side effects
    if coupon:
        await db.coupons.update_one({"id": coupon["id"]}, {"$inc": {"uses": 1}})
    earned = int(subtotal * float(loyalty.get("points_per_htg", 0)))
    inc = {"loyalty_points": earned - doc["redeemed_points"]}
    await db.customers.update_one({"email": customer.email}, {"$inc": inc})
    return doc

# ---------------------- Customer auth routes ----------------------
@api_router.post("/customer/auth/session")
async def customer_auth_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id manquant")
    try:
        r = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}, timeout=15,
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.error(f"Customer auth failed: {e}")
        raise HTTPException(401, "Échec authentification")
    email = data.get("email", "").strip().lower()
    if not email:
        raise HTTPException(401, "Email introuvable")
    existing = await db.customers.find_one({"email": email})
    if not existing:
        c = Customer(email=email, name=data.get("name"), picture=data.get("picture"))
        loy = await get_loyalty()
        doc = c.model_dump()
        doc["loyalty_points"] = int(loy.get("welcome_points", 0))
        doc["is_reseller"] = False
        await db.customers.insert_one(doc)
    else:
        await db.customers.update_one(
            {"email": email},
            {"$set": {"name": data.get("name"), "picture": data.get("picture")}}
        )
    session_token = data.get("session_token") or str(uuid.uuid4())
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.customer_sessions.insert_one({
        "session_token": session_token,
        "email": email,
        "expires_at": expires.isoformat(),
        "created_at": now_iso(),
    })
    response.set_cookie(
        "customer_session_token", session_token,
        httponly=True, secure=True, samesite="none",
        max_age=7 * 24 * 3600, path="/"
    )
    c = await db.customers.find_one({"email": email}, {"_id": 0})
    return {"user": c}

@api_router.get("/customer/auth/me")
async def customer_me(request: Request):
    c = await current_customer(request)
    return c.model_dump()

@api_router.post("/customer/auth/logout")
async def customer_logout(request: Request, response: Response):
    token = request.cookies.get("customer_session_token")
    if token:
        await db.customer_sessions.delete_one({"session_token": token})
    response.delete_cookie("customer_session_token", path="/")
    return {"ok": True}

@api_router.get("/customer/orders")
async def customer_orders(request: Request):
    c = await current_customer(request)
    orders = await db.orders.find({"customer_email": c.email}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return orders

@api_router.get("/orders/lookup")
async def lookup_orders(q: str):
    q = (q or "").strip()
    if not q:
        return []
    query = {"$or": [{"customer_phone": q}, {"order_number": q.upper()}, {"customer_email": q.lower()}]}
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders

@api_router.get("/orders/{order_number}")
async def get_order(order_number: str):
    o = await db.orders.find_one({"order_number": order_number.upper()}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Commande introuvable")
    return o

# ---------------------- Auth (Emergent) ----------------------
@api_router.post("/auth/session")
async def auth_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(400, "session_id manquant")
    try:
        r = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}, timeout=15
        )
        r.raise_for_status()
        data = r.json()
    except Exception as e:
        logger.error(f"Auth exchange failed: {e}")
        raise HTTPException(401, "Échec de l'authentification")
    email = data.get("email", "").strip().lower()
    if not email:
        raise HTTPException(401, "Email introuvable")
    # bootstrap: if no admins exist, first login becomes super admin
    admins_count = await db.admins.count_documents({})
    if admins_count == 0:
        await db.admins.insert_one({
            **AdminUser(email=email, name=data.get("name"), picture=data.get("picture"), role="super_admin").model_dump()
        })
    else:
        admin = await db.admins.find_one({"email": email})
        if not admin:
            raise HTTPException(403, "Cet email n'est pas autorisé. Contactez le Super Admin.")
        # update name/picture
        await db.admins.update_one({"email": email}, {"$set": {"name": data.get("name"), "picture": data.get("picture")}})
    session_token = data.get("session_token") or str(uuid.uuid4())
    expires = datetime.now(timezone.utc) + timedelta(days=7)
    await db.admin_sessions.insert_one({
        "session_token": session_token,
        "email": email,
        "expires_at": expires.isoformat(),
        "created_at": now_iso(),
    })
    response.set_cookie(
        "session_token", session_token,
        httponly=True, secure=True, samesite="none",
        max_age=7 * 24 * 3600, path="/"
    )
    admin = await db.admins.find_one({"email": email}, {"_id": 0})
    return {"user": admin, "session_token": session_token}

@api_router.get("/auth/me")
async def auth_me(request: Request):
    admin = await current_admin(request)
    return admin.model_dump()

@api_router.post("/auth/logout")
async def auth_logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.admin_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}

# ---------------------- Admin: Products ----------------------
@api_router.post("/admin/products")
async def admin_create_product(body: ProductIn, request: Request):
    await current_admin(request)
    p = Product(**body.model_dump())
    await db.products.insert_one(p.model_dump())
    return p.model_dump()

@api_router.put("/admin/products/{product_id}")
async def admin_update_product(product_id: str, body: ProductIn, request: Request):
    await current_admin(request)
    r = await db.products.update_one({"id": product_id}, {"$set": body.model_dump()})
    if r.matched_count == 0:
        raise HTTPException(404, "Produit introuvable")
    p = await db.products.find_one({"id": product_id}, {"_id": 0})
    return p

@api_router.delete("/admin/products/{product_id}")
async def admin_delete_product(product_id: str, request: Request):
    await current_admin(request)
    await db.products.delete_one({"id": product_id})
    return {"ok": True}

# ---------------------- Admin: Categories ----------------------
class CategoryIn(BaseModel):
    name: str
    slug: str
    icon: Optional[str] = None

@api_router.post("/admin/categories")
async def admin_create_category(body: CategoryIn, request: Request):
    await current_admin(request)
    c = Category(**body.model_dump())
    await db.categories.insert_one(c.model_dump())
    return c.model_dump()

@api_router.put("/admin/categories/{cat_id}")
async def admin_update_category(cat_id: str, body: CategoryIn, request: Request):
    await current_admin(request)
    await db.categories.update_one({"id": cat_id}, {"$set": body.model_dump()})
    return await db.categories.find_one({"id": cat_id}, {"_id": 0})

@api_router.delete("/admin/categories/{cat_id}")
async def admin_delete_category(cat_id: str, request: Request):
    await current_admin(request)
    await db.categories.delete_one({"id": cat_id})
    return {"ok": True}

# ---------------------- Admin: Orders ----------------------
@api_router.get("/admin/orders")
async def admin_list_orders(request: Request, status: Optional[str] = None):
    await current_admin(request)
    q = {}
    if status:
        q["status"] = status
    orders = await db.orders.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return orders

class OrderAction(BaseModel):
    reason: Optional[str] = None

async def log_admin_action(admin_email: str, action: str, target: str, details: dict = None):
    await db.admin_logs.insert_one({
        "id": str(uuid.uuid4()),
        "admin_email": admin_email,
        "action": action,
        "target": target,
        "details": details or {},
        "created_at": now_iso(),
    })

@api_router.post("/admin/orders/{order_id}/approve")
async def admin_approve_order(order_id: str, request: Request):
    admin = await current_admin(request)
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "approved", "updated_at": now_iso(), "rejection_reason": None}})
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if o:
        await send_status_email(o)
        await db.notifications.insert_one({"id": str(uuid.uuid4()), "customer_email": o.get("customer_email"), "order_number": o["order_number"], "status": "approved", "message": f"Votre commande {o['order_number']} a été approuvée ✅", "read": False, "created_at": now_iso()})
        await log_admin_action(admin.email, "approve_order", o["order_number"])
    return o

@api_router.post("/admin/orders/{order_id}/reject")
async def admin_reject_order(order_id: str, body: OrderAction, request: Request):
    admin = await current_admin(request)
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "rejected", "rejection_reason": body.reason or "", "updated_at": now_iso()}})
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if o:
        await send_status_email(o)
        await db.notifications.insert_one({"id": str(uuid.uuid4()), "customer_email": o.get("customer_email"), "order_number": o["order_number"], "status": "rejected", "message": f"Votre commande {o['order_number']} a été refusée. Raison: {body.reason or '—'}", "read": False, "created_at": now_iso()})
        await log_admin_action(admin.email, "reject_order", o["order_number"], {"reason": body.reason})
    return o

@api_router.post("/admin/orders/{order_id}/complete")
async def admin_complete_order(order_id: str, request: Request):
    admin = await current_admin(request)
    await db.orders.update_one({"id": order_id}, {"$set": {"status": "completed", "updated_at": now_iso()}})
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if o:
        await send_status_email(o)
        await db.notifications.insert_one({"id": str(uuid.uuid4()), "customer_email": o.get("customer_email"), "order_number": o["order_number"], "status": "completed", "message": f"Votre commande {o['order_number']} est terminée 🎉", "read": False, "created_at": now_iso()})
        await log_admin_action(admin.email, "complete_order", o["order_number"])
    return o

# ---------------------- Customer notifications ----------------------
@api_router.get("/customer/notifications")
async def customer_notifications(request: Request):
    c = await current_customer(request)
    notifs = await db.notifications.find({"customer_email": c.email}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return notifs

@api_router.post("/customer/notifications/read-all")
async def customer_notifs_read(request: Request):
    c = await current_customer(request)
    await db.notifications.update_many({"customer_email": c.email, "read": False}, {"$set": {"read": True}})
    return {"ok": True}

# ---------------------- Support: Contact & FAQ ----------------------
class ContactIn(BaseModel):
    name: str
    email: str
    subject: str = ""
    message: str

_contact_cache = {}
@api_router.post("/contact")
async def submit_contact(body: ContactIn, request: Request):
    # anti-spam: 1 message / 60s per ip
    ip = request.client.host if request.client else "unknown"
    last = _contact_cache.get(ip, 0)
    now = datetime.now(timezone.utc).timestamp()
    if now - last < 60:
        raise HTTPException(429, "Merci de patienter avant d'envoyer un autre message.")
    _contact_cache[ip] = now
    if len(body.message.strip()) < 10:
        raise HTTPException(400, "Message trop court")
    await db.contact_messages.insert_one({
        "id": str(uuid.uuid4()),
        "name": body.name.strip(),
        "email": body.email.strip().lower(),
        "subject": body.subject.strip(),
        "message": body.message.strip(),
        "ip": ip,
        "created_at": now_iso(),
    })
    return {"ok": True}

@api_router.get("/admin/contact-messages")
async def admin_contact_messages(request: Request):
    await current_admin(request)
    return await db.contact_messages.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

# ---------------------- Admin audit logs ----------------------
@api_router.get("/admin/logs")
async def admin_logs(request: Request):
    await current_admin(request)
    return await db.admin_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

# ---------------------- Admin: Settings ----------------------
class SettingsIn(BaseModel):
    margin_percent: Optional[float] = None
    moncash_number: Optional[str] = None
    moncash_beneficiary: Optional[str] = None
    natcash_number: Optional[str] = None
    natcash_beneficiary: Optional[str] = None
    payment_instructions: Optional[str] = None
    site_title: Optional[str] = None
    site_tagline: Optional[str] = None
    hero_heading: Optional[str] = None
    hero_subheading: Optional[str] = None
    whatsapp_support: Optional[str] = None

@api_router.get("/admin/settings")
async def admin_get_settings(request: Request):
    await current_admin(request)
    return await get_settings()

@api_router.put("/admin/settings")
async def admin_update_settings(body: SettingsIn, request: Request):
    admin = await current_admin(request)
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    patch["updated_at"] = now_iso()
    await db.settings.update_one({"id": "singleton"}, {"$set": patch}, upsert=True)
    await log_admin_action(admin.email, "update_settings", "settings", {"keys": list(patch.keys())})
    return await get_settings()

# ---------------------- Admin: Banners ----------------------
class BannerIn(BaseModel):
    title: str
    subtitle: str = ""
    image_url: str = ""
    link_url: str = ""
    active: bool = True
    order: int = 0

@api_router.get("/admin/banners")
async def admin_list_banners(request: Request):
    await current_admin(request)
    return await db.banners.find({}, {"_id": 0}).sort("order", 1).to_list(200)

@api_router.post("/admin/banners")
async def admin_create_banner(body: BannerIn, request: Request):
    await current_admin(request)
    b = Banner(**body.model_dump())
    await db.banners.insert_one(b.model_dump())
    return b.model_dump()

@api_router.put("/admin/banners/{banner_id}")
async def admin_update_banner(banner_id: str, body: BannerIn, request: Request):
    await current_admin(request)
    await db.banners.update_one({"id": banner_id}, {"$set": body.model_dump()})
    return await db.banners.find_one({"id": banner_id}, {"_id": 0})

@api_router.delete("/admin/banners/{banner_id}")
async def admin_delete_banner(banner_id: str, request: Request):
    await current_admin(request)
    await db.banners.delete_one({"id": banner_id})
    return {"ok": True}

# ---------------------- Admin: Admins allowlist ----------------------
@api_router.get("/admin/admins")
async def admin_list_admins(request: Request):
    await require_super_admin(request)
    return await db.admins.find({}, {"_id": 0}).to_list(200)

@api_router.post("/admin/admins")
async def admin_add_admin(body: AdminIn, request: Request):
    await require_super_admin(request)
    email = body.email.strip().lower()
    existing = await db.admins.find_one({"email": email})
    if existing:
        raise HTTPException(400, "Cet email est déjà admin")
    role = "super_admin" if body.role == "super_admin" else "admin"
    a = AdminUser(email=email, role=role)
    await db.admins.insert_one(a.model_dump())
    return a.model_dump()

@api_router.delete("/admin/admins/{admin_id}")
async def admin_remove_admin(admin_id: str, request: Request):
    me = await require_super_admin(request)
    a = await db.admins.find_one({"id": admin_id})
    if not a:
        raise HTTPException(404, "Admin introuvable")
    if a["email"] == me.email:
        raise HTTPException(400, "Vous ne pouvez pas vous supprimer vous-même")
    await db.admins.delete_one({"id": admin_id})
    return {"ok": True}

# ---------------------- Subscriptions ----------------------
class Subscription(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    image_url: str = ""
    base_price: float
    duration_days: int = 30
    features: List[str] = []
    active: bool = True
    created_at: str = Field(default_factory=now_iso)

class SubscriptionIn(BaseModel):
    name: str
    description: str = ""
    image_url: str = ""
    base_price: float
    duration_days: int = 30
    features: List[str] = []
    active: bool = True

@api_router.get("/subscriptions")
async def list_subscriptions():
    items = await db.subscriptions.find({"active": True}, {"_id": 0}).to_list(200)
    s = await get_settings()
    m = float(s["margin_percent"])
    for it in items:
        it["price"] = round(float(it["base_price"]) * (1 + m/100), 2)
    return items

@api_router.get("/admin/subscriptions")
async def admin_list_subs(request: Request):
    await current_admin(request)
    return await db.subscriptions.find({}, {"_id": 0}).to_list(200)

@api_router.post("/admin/subscriptions")
async def admin_create_sub(body: SubscriptionIn, request: Request):
    a = await current_admin(request)
    s = Subscription(**body.model_dump())
    await db.subscriptions.insert_one(s.model_dump())
    await log_admin_action(a.email, "create_subscription", s.name)
    return s.model_dump()

@api_router.put("/admin/subscriptions/{sid}")
async def admin_update_sub(sid: str, body: SubscriptionIn, request: Request):
    a = await current_admin(request)
    await db.subscriptions.update_one({"id": sid}, {"$set": body.model_dump()})
    await log_admin_action(a.email, "update_subscription", sid)
    return await db.subscriptions.find_one({"id": sid}, {"_id": 0})

@api_router.delete("/admin/subscriptions/{sid}")
async def admin_delete_sub(sid: str, request: Request):
    a = await current_admin(request)
    await db.subscriptions.delete_one({"id": sid})
    await log_admin_action(a.email, "delete_subscription", sid)
    return {"ok": True}

# ---------------------- Coupons ----------------------
class Coupon(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    discount_percent: float = 0
    discount_amount: float = 0
    active: bool = True
    max_uses: int = 0  # 0 = illimité
    uses: int = 0
    expires_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)

class CouponIn(BaseModel):
    code: str
    discount_percent: float = 0
    discount_amount: float = 0
    active: bool = True
    max_uses: int = 0
    expires_at: Optional[str] = None

@api_router.get("/coupons/validate")
async def validate_coupon(code: str):
    c = await db.coupons.find_one({"code": code.upper().strip(), "active": True}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Coupon invalide")
    if c.get("max_uses", 0) > 0 and c.get("uses", 0) >= c["max_uses"]:
        raise HTTPException(400, "Coupon épuisé")
    if c.get("expires_at"):
        try:
            exp = datetime.fromisoformat(c["expires_at"])
            if exp.tzinfo is None: exp = exp.replace(tzinfo=timezone.utc)
            if exp < datetime.now(timezone.utc): raise HTTPException(400, "Coupon expiré")
        except (ValueError, TypeError): pass
    return c

@api_router.get("/admin/coupons")
async def admin_coupons(request: Request):
    await current_admin(request)
    return await db.coupons.find({}, {"_id": 0}).to_list(500)

@api_router.post("/admin/coupons")
async def admin_create_coupon(body: CouponIn, request: Request):
    a = await current_admin(request)
    body_dict = body.model_dump()
    body_dict["code"] = body_dict["code"].upper().strip()
    c = Coupon(**body_dict)
    await db.coupons.insert_one(c.model_dump())
    await log_admin_action(a.email, "create_coupon", c.code)
    return c.model_dump()

@api_router.put("/admin/coupons/{cid}")
async def admin_update_coupon(cid: str, body: CouponIn, request: Request):
    a = await current_admin(request)
    body_dict = body.model_dump()
    body_dict["code"] = body_dict["code"].upper().strip()
    await db.coupons.update_one({"id": cid}, {"$set": body_dict})
    await log_admin_action(a.email, "update_coupon", cid)
    return await db.coupons.find_one({"id": cid}, {"_id": 0})

@api_router.delete("/admin/coupons/{cid}")
async def admin_delete_coupon(cid: str, request: Request):
    a = await current_admin(request)
    await db.coupons.delete_one({"id": cid})
    await log_admin_action(a.email, "delete_coupon", cid)
    return {"ok": True}

# ---------------------- Loyalty & Reseller ----------------------
DEFAULT_LOYALTY = {
    "id": "singleton",
    "active": True,
    "points_per_htg": 0.01,  # 1 point / 100 HTG
    "htg_per_point": 1.0,  # 1 point = 1 HTG discount
    "min_redeem_points": 100,
    "reseller_discount_percent": 15.0,
    "reseller_commission_percent": 10.0,
    "welcome_points": 50,
}

async def get_loyalty():
    l = await db.loyalty.find_one({"id": "singleton"}, {"_id": 0})
    if not l:
        await db.loyalty.insert_one({**DEFAULT_LOYALTY})
        return dict(DEFAULT_LOYALTY)
    return {**DEFAULT_LOYALTY, **l}

class LoyaltyIn(BaseModel):
    active: Optional[bool] = None
    points_per_htg: Optional[float] = None
    htg_per_point: Optional[float] = None
    min_redeem_points: Optional[int] = None
    reseller_discount_percent: Optional[float] = None
    reseller_commission_percent: Optional[float] = None
    welcome_points: Optional[int] = None

@api_router.get("/loyalty/config")
async def public_loyalty():
    l = await get_loyalty()
    return {k: l[k] for k in ["active", "points_per_htg", "htg_per_point", "min_redeem_points", "welcome_points"]}

@api_router.get("/admin/loyalty")
async def admin_loyalty(request: Request):
    await current_admin(request)
    return await get_loyalty()

@api_router.put("/admin/loyalty")
async def admin_update_loyalty(body: LoyaltyIn, request: Request):
    a = await current_admin(request)
    patch = {k: v for k, v in body.model_dump().items() if v is not None}
    await db.loyalty.update_one({"id": "singleton"}, {"$set": patch}, upsert=True)
    await log_admin_action(a.email, "update_loyalty", "config", {"keys": list(patch.keys())})
    return await get_loyalty()

@api_router.get("/customer/loyalty")
async def customer_loyalty(request: Request):
    c = await current_customer(request)
    doc = await db.customers.find_one({"email": c.email}, {"_id": 0})
    return {"points": doc.get("loyalty_points", 0), "is_reseller": doc.get("is_reseller", False)}

class ResellerToggle(BaseModel):
    is_reseller: bool

@api_router.post("/admin/customers/{email}/reseller")
async def admin_toggle_reseller(email: str, body: ResellerToggle, request: Request):
    a = await current_admin(request)
    await db.customers.update_one({"email": email.lower()}, {"$set": {"is_reseller": body.is_reseller}}, upsert=False)
    await log_admin_action(a.email, "toggle_reseller", email, {"is_reseller": body.is_reseller})
    return {"ok": True}

@api_router.get("/admin/resellers")
async def admin_list_resellers(request: Request):
    await current_admin(request)
    return await db.customers.find({"is_reseller": True}, {"_id": 0}).to_list(500)

# ---------------------- Admin: Stats ----------------------
@api_router.get("/admin/stats")
async def admin_stats(request: Request):
    await current_admin(request)
    orders = await db.orders.find({}, {"_id": 0}).to_list(10000)
    by_status = {"pending": 0, "approved": 0, "rejected": 0, "completed": 0}
    revenue = 0.0
    unique_customers = set()
    for o in orders:
        by_status[o.get("status", "pending")] = by_status.get(o.get("status", "pending"), 0) + 1
        if o.get("status") in ("approved", "completed"):
            revenue += float(o.get("total_amount", 0))
        if o.get("customer_phone"):
            unique_customers.add(o["customer_phone"])
    products_count = await db.products.count_documents({})
    return {
        "total_orders": len(orders),
        "pending": by_status["pending"],
        "approved": by_status["approved"],
        "rejected": by_status["rejected"],
        "completed": by_status["completed"],
        "revenue": round(revenue, 2),
        "products": products_count,
        "customers": len(unique_customers),
    }

@api_router.get("/admin/customers")
async def admin_customers(request: Request):
    await current_admin(request)
    orders = await db.orders.find({}, {"_id": 0}).to_list(10000)
    by_phone = {}
    for o in orders:
        p = o.get("customer_phone")
        if not p:
            continue
        if p not in by_phone:
            by_phone[p] = {
                "phone": p,
                "name": o.get("customer_name", ""),
                "email": o.get("customer_email"),
                "orders_count": 0,
                "total_spent": 0.0,
            }
        by_phone[p]["orders_count"] += 1
        if o.get("status") in ("approved", "completed"):
            by_phone[p]["total_spent"] += float(o.get("total_amount", 0))
    return list(by_phone.values())

# ---------------------- Include & CORS ----------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
