import pytest
from helpers import SessionClient, TestSessionConfig


@pytest.mark.asyncio
async def test_postman_echo_read_multivalue_headers():
    async with SessionClient("http://postman-echo.com") as session:
        async with session.get("response-headers?foo1=bar1&foo1=bar2") as resp:
            bars = resp.headers.getall('foo1')
            assert bars == ['bar1', 'bar2']


@pytest.mark.asyncio
async def test_postman_echo_send_multivalue_headers():
    async with SessionClient("http://postman-echo.com") as session:
        async with session.get("headers", headers=[("foo1", "bar1"), ("foo1", "bar2")]) as r:
            body = await r.json()

            assert body["headers"]["foo1"] == "bar1, bar2"


@pytest.mark.asyncio
async def test_api_status(api: SessionClient):

    async with api.get("_status") as r:
        assert r.status == 200
        body = await r.json()

        assert body == dict(ping='pong', service='sync-wrap')


@pytest.mark.asyncio
async def test_app_ping(api: SessionClient, test_config: TestSessionConfig):

    async with api.get("_ping") as r:
        assert r.status == 200
        body = await r.json()

        assert body["version"] == test_config.service_base_path


@pytest.mark.asyncio
async def test_api_status_with_service_header_another_service(api: SessionClient):

    async with api.get("_status", headers={'x-apim-service': 'async-slowapp'}) as r:
        assert r.status == 200
        body = await r.json()

        assert body == dict(ping='pong', service='sync-wrap')


@pytest.mark.asyncio
async def test_api_status_with_service_header(api: SessionClient):

    async with api.get("_status", headers={'x-apim-service': 'sync-wrap'}) as r:
        assert r.status == 200
        body = await r.json()

        assert body == dict(ping='pong', service='sync-wrap')


@pytest.mark.asyncio
async def test_api_slowapp_slower_than_sync_wait(api: SessionClient):

    async with api.get("async-slowapp/slow?delay=5", headers={'x-sync-wait': '0.25'}) as r:
        assert r.status == 504


@pytest.mark.asyncio
async def test_api_slowapp_responds_test_final_status(api: SessionClient):

    async with api.get("async-slowapp/slow?final_status=418&complete_in=0.5") as r:
        assert r.status == 418
        assert r.reason == "I'm a teapot"
