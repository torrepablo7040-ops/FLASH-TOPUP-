# FLASH-Topup Auth Testing Playbook

Admin auth uses Emergent Google OAuth. Test with a pre-seeded session:

## Create Test Admin Session
```bash
mongosh --eval "
use('test_database');
var email = 'torrepablo7040@gmail.com';
db.admins.updateOne({email: email}, {\$set: {email: email, role: 'super_admin', name: 'Super Admin'}}, {upsert: true});
var token = 'test_session_' + Date.now();
db.admin_sessions.insertOne({
  session_token: token,
  email: email,
  expires_at: new Date(Date.now() + 7*24*60*60*1000).toISOString(),
  created_at: new Date().toISOString()
});
print('SESSION_TOKEN=' + token);
"
```

## Backend calls
```bash
curl -H "Authorization: Bearer $TOKEN" $BASE/api/auth/me
curl -H "Authorization: Bearer $TOKEN" $BASE/api/admin/stats
```

## Frontend
Set cookie `session_token` on the app domain before navigating to `/admin`.
