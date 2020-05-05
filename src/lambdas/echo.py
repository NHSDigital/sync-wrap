import logging
import json
import os
LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)


def handler(event, context):
    LOGGER.info("I've been called!")
    return {
        "body": json.dumps(dict(event=event, env={k: v for k, v in os.environ.items()}))
    }
