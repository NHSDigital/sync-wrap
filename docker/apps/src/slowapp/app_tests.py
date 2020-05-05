import asyncio
from uuid import uuid4

import pytest
from yarl import URL

from slowapp.app import SlowApp


@pytest.fixture(scope='function')
def slowapp() -> SlowApp:
    return SlowApp()


async def test_set_id(aiohttp_client, slowapp):

    client = await aiohttp_client(slowapp)
    poll_id = uuid4().hex
    resp = await client.get(f'/slow?delay=0.1&id={poll_id}')
    assert resp.status == 202
    assert resp.headers['Content-Location'].endswith(f'/poll?id={poll_id}')


async def test_start_and_delete(aiohttp_client, slowapp):

    client = await aiohttp_client(slowapp)
    resp = await client.get(f'/slow')
    assert resp.status == 202
    poll_url = URL(resp.headers['Content-Location'])
    resp = await client.delete(poll_url.raw_path_qs)
    assert resp.status == 200


async def test_start_and_finish_with_status(aiohttp_client, slowapp):

    client = await aiohttp_client(slowapp)
    resp = await client.get(f'/slow?complete_in=0.1&final_status=500')
    assert resp.status == 202
    poll_url = URL(resp.headers['Content-Location'])
    assert resp.cookies['poll-count'].value == '0'
    await asyncio.sleep(0.5)
    resp = await client.get(poll_url.raw_path_qs)
    assert resp.status == 500


async def test_start_and_still_running(aiohttp_client, slowapp):

    client = await aiohttp_client(slowapp)
    resp = await client.get(f'/slow?final_status=500')
    assert resp.status == 202
    poll_url = URL(resp.headers['Content-Location'])
    await asyncio.sleep(0.5)
    resp = await client.get(poll_url.raw_path_qs, cookies={'poll-count': '6'})
    assert resp.status == 202
    assert resp.cookies['poll-count'].value == '7'
