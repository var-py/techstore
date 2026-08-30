from app.utils.security import hash_password, verify_password

def test_password_hashing():
    password = 'qwerty12'
    password_hash=hash_password(password)

    assert password_hash != password
    assert verify_password(password, password_hash) is True
    assert verify_password("WrongPassword", password_hash) is False

def test_same_password_has_different_valid_hashes():
    password = 'qwerty12'

    hash1 = hash_password(password)
    hash2 = hash_password(password)

    assert hash1 != hash2
    assert verify_password(password, hash1) is True
    assert verify_password(password, hash2) is True