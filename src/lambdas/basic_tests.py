from lambdas.helpers import WithNamedLambda, invoke_function_and_get_message


def test_thing():
    assert True


def test_temp_dir(temp_dir):
    assert temp_dir


@WithNamedLambda('basic')
def test_named_lambda_invoke():
    resp = invoke_function_and_get_message('basic')
    assert resp
    assert resp['message'] == "Hello pytest!"


def test_temp_lambda_invoke(temp_lambda):
    resp = invoke_function_and_get_message(temp_lambda)
    assert resp
    assert resp['message'] == "Hello pytest!"
