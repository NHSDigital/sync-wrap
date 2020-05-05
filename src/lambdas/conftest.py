import os
import tempfile
from uuid import uuid4
from typing import Generator

import pytest


from lambdas.helpers import create_lambda, delete_lambda


@pytest.fixture()
def temp_dir() -> Generator[str, None, None]:
    """ create a temporary folder and cleanup afterwards
    """
    with tempfile.TemporaryDirectory('_dsp', prefix='pytest_') as temp_dir_name:
        yield temp_dir_name


@pytest.fixture(scope='session', autouse=True)
def global_setup():
    os.environ.setdefault('env', 'local')


@pytest.fixture(scope='function', params=['temp_lambda'])
def temp_lambda(request) -> Generator[str, None, None]:
    """
        create a lambda from the python file corresponding to the test file
        e.g. if invoked in  'src/lambdas/thing_tests.py' .. will create a lambda from  'src/lambdas/thing.py' if exists
    """
    path = request.fspath
    assert path.strpath.endswith('_tests.py')
    lambda_path = path.strpath.replace('_tests.py', '.py')
    lambda_name = f'temp-{uuid4().hex}'
    create_lambda(lambda_name, lambda_path)

    yield lambda_name

    delete_lambda(lambda_name)


@pytest.fixture(scope='function')
def temp_env() -> Generator[dict, None, None]:
    """ create a environment vars
    """
    before = {k: v for k, v in os.environ.items()}

    yield os.environ

    os.environ.clear()
    for k, v in before.items():
        os.environ[k] = v