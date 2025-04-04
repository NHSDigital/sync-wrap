SHELL := /bin/bash
########################################################################################################################
##
## app e2e tests
##
########################################################################################################################
pwd := ${PWD}
dirname := $(notdir $(patsubst %/,%,$(CURDIR)))
activate = poetry run

list:
	@grep '^[^#[:space:]].*:' Makefile

guard-%:
	@ if [ "${${*}}" = "" ]; then \
		echo "Environment variable $* not set"; \
		exit 1; \
	fi

TEST_CMD := pytest \
		--color=yes \
		--api-name=sync-wrap \
		--proxy-name=$(PROXY_NAME) \

ifdef APIGEE_ORGANIZATION
  TEST_CMD += --apigee-organization=$(APIGEE_ORGANIZATION)
endif

test:
	$(activate) $(TEST_CMD) -vs

e2e:
	rm -f ../reports/e2e.xml  > /dev/null || true
	$(activate) coverage run --source ./ --module $(TEST_CMD) -rxs -v --junit-xml=../reports/e2e.xml --ignore .venv || true
	@if [[ ! -f ../reports/e2e.xml ]]; then echo report not created; exit 1; fi

smoketest:
	rm -f ../reports/smoketest.xml  > /dev/null || true
	$(activate) coverage run --source ./ --module $(TEST_CMD) -m smoketest -rxs -v --junit-xml=../reports/smoketest.xml --ignore .venv || true
	@if [[ ! -f ../reports/smoketest.xml ]]; then echo report not created; exit 1; fi
