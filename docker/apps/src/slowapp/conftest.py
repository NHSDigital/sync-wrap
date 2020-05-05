import asyncio

import pytest


@pytest.yield_fixture(scope='session')
def event_loop(request):
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope='session')
def loop(event_loop):
    """Ensure usable event loop for everyone.

    If you comment this fixture out, default pytest-aiohttp one is used
    and this will break the asyncio.Lock in the controller / pool manager tests
    """
    return event_loop
