import json
import os
import string
import secrets
import boto3
from botocore.exceptions import ClientError

dynamodb = boto3.resource("dynamodb")
TABLE_NAME = os.environ["TABLE_NAME"]
table = dynamodb.Table(TABLE_NAME)

ALPHABET = string.ascii_letters + string.digits  # base62
CODE_LENGTH = 6
MAX_RETRIES = 5


def lambda_handler(event, context):
    route = event.get("routeKey", "")

    if route == "POST /shorten":
        return handle_shorten(event)
    if route == "GET /{shortCode}":
        return handle_redirect(event)

    return _response(404, {"error": "Not found"})


def handle_shorten(event):
    try:
        raw_body = event.get("body", "{}")
        body = json.loads(raw_body) if isinstance(raw_body, str) else raw_body

        long_url = body.get("long_url", "").strip()
        if not long_url:
            return _response(400, {"error": "long_url is required"})

        # Try generating a code and writing it, retrying only on collision
        for _ in range(MAX_RETRIES):
            short_code = "".join(secrets.choice(ALPHABET) for _ in range(CODE_LENGTH))

            try:
                table.put_item(
                    Item={"shortCode": short_code, "long_url": long_url},
                    ConditionExpression="attribute_not_exists(shortCode)",
                )
                # Success — no collision, return immediately
                return _response(200, {"short_code": short_code})

            except ClientError as e:
                if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
                    # Collision — loop again with a new random code
                    continue
                raise  # some other real error, don't swallow it

        # Only reached if we ran out of retries (extremely unlikely)
        return _response(500, {"error": "Could not generate a unique code, try again"})

    except json.JSONDecodeError:
        return _response(400, {"error": "Invalid JSON request body."})
    except Exception as e:
        print(f"Error in handle_shorten: {e}")
        return _response(500, {"error": "Internal server error."})


def handle_redirect(event):
    try:
        short_code = event.get("pathParameters", {}).get("shortCode", "")
        if not short_code:
            return _response(400, {"error": "Missing short code"})

        result = table.get_item(Key={"shortCode": short_code})
        item = result.get("Item")

        if not item:
            return _response(404, {"error": "Short code not found"})

        return _response(302, {}, headers={"Location": item["long_url"]})

    except Exception as e:
        print(f"Error in handle_redirect: {e}")
        return _response(500, {"error": "Internal server error."})


def _response(status_code, body_dict, headers=None):
    base_headers = {"Content-Type": "application/json"}
    if headers:
        base_headers.update(headers)
    return {
        "statusCode": status_code,
        "headers": base_headers,
        "body": json.dumps(body_dict),
    }
