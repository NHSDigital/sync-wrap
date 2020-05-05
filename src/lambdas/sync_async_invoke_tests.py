from lambdas.helpers import invoke_function_and_get_message, apigateway_event


def test_lambda_invoke(temp_lambda):
    resp = invoke_function_and_get_message(temp_lambda, apigateway_event())
    assert resp

