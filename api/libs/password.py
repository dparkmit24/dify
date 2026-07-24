import base64
import binascii
import hashlib
import re

password_pattern = r"^(?=.*[a-zA-Z])(?=.*\d).{8,}$"


def valid_password(password):
    # Define a regex pattern for password rules
    pattern = password_pattern
    # Use re.fullmatch instead of re.match to reject trailing newlines.
    # In Python, '$' matches at end-of-string OR just before a trailing newline,
    # so re.match accepts "Password123\n". re.fullmatch requires the entire
    # string to match, closing the same class of bug fixed for email(). (#39548)
    if re.fullmatch(pattern, password) is not None:
        return password

    raise ValueError("Password must contain letters and numbers, and the length must be at least 8 characters.")


def hash_password(password_str: str, salt_byte: bytes):
    dk = hashlib.pbkdf2_hmac("sha256", password_str.encode("utf-8"), salt_byte, 10000)
    return binascii.hexlify(dk)


def compare_password(password_str, password_hashed_base64, salt_base64):
    # compare password for login
    return hash_password(password_str, base64.b64decode(salt_base64)) == base64.b64decode(password_hashed_base64)
