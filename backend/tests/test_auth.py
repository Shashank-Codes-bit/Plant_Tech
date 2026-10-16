"""Sign up, log in, lockout, Google sign-in, password change."""
import auth
from conftest import Shop


def test_register_creates_owner_and_empty_shop(client):
    r = client.post("/api/auth/register", json={"name": "Suresh", "phone": "+91 98111-22334", "password": "secret123"})
    assert r.status_code == 200, r.text
    user = r.json()["user"]
    assert user["role"] == "owner" and user["phone"] == "+919811122334"
    assert user["business"]["onboarding_done"] is False
    assert all(user["permissions"].values())
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['token']}"})
    assert me.json()["id"] == user["id"]
    assert client.get("/api/products", headers={"Authorization": f"Bearer {r.json()['token']}"}).json() == []


def test_register_rejects_bad_input(client):
    ok = {"name": "A", "phone": "9811122334", "password": "secret123"}
    assert client.post("/api/auth/register", json={**ok, "phone": "12345"}).status_code == 400
    assert client.post("/api/auth/register", json={**ok, "password": "short"}).status_code == 422
    assert client.post("/api/auth/register", json=ok).status_code == 200
    assert client.post("/api/auth/register", json=ok).status_code == 409  # same phone again


def test_login_and_lockout(client):
    Shop(client)
    good = {"phone": "98111 22334", "password": "secret123"}
    assert client.post("/api/auth/login", json=good).status_code == 200
    for _ in range(auth.MAX_FAILED_LOGINS):
        assert client.post("/api/auth/login", json={**good, "password": "nope"}).status_code == 401
    assert client.post("/api/auth/login", json=good).status_code == 429  # locked even with the right password
    assert client.post("/api/auth/login", json={"phone": "9999999999", "password": "x"}).status_code == 401


def test_requests_need_a_valid_token(client):
    assert client.get("/api/products").status_code == 401
    assert client.get("/api/products", headers={"Authorization": "Bearer junk"}).status_code == 401
    assert client.get("/health").json() == {"ok": True}


def test_google_sign_in_creates_then_reuses_owner(client, monkeypatch):
    monkeypatch.setattr(auth, "verify_google_id_token",
                        lambda t: {"sub": "g-123", "email": "owner@example.com", "name": "Asha"})
    first = client.post("/api/auth/google", json={"id_token": "x"}).json()
    second = client.post("/api/auth/google", json={"id_token": "x"}).json()
    assert first["user"]["id"] == second["user"]["id"]
    assert first["user"]["name"] == "Asha" and first["user"]["has_password"] is False


def test_google_not_configured_is_clear(client):
    assert client.post("/api/auth/google", json={"id_token": "x"}).status_code == 503


def test_password_change_logs_out_old_sessions(client):
    shop = Shop(client)
    r = shop.post("/api/auth/password", {"current_password": "secret123", "new_password": "newsecret1"})
    assert r.status_code == 200
    assert shop.get("/api/auth/me").status_code == 401  # old token no longer works
    new = {"Authorization": f"Bearer {r.json()['token']}"}
    assert client.get("/api/auth/me", headers=new).status_code == 200
    assert client.post("/api/auth/login", json={"phone": "9811122334", "password": "newsecret1"}).status_code == 200
