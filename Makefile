SHELL := /bin/bash
########################################################################################################################
##
## Makefile for managing sync async
##
########################################################################################################################
activate = pipenv run
compose_files = ${COMPOSE_FILES}
pwd := ${PWD}
dirname := $(notdir ${PWD})
pylint_folders := src/shared
features = features
subenvs := docker/services
docker_tests := services
export PIPENV_VENV_IN_PROJECT = 1
export PIPENV_IGNORE_VIRTUALENVS = 1
export PIPENV_NO_INHERIT = 1
export PIPENV_MAX_DEPTH = 1
export PIPENV_NOSPIN = 1

guard-%:
	@ if [ "${${*}}" = "" ]; then \
		echo "Environment variable $* not set"; \
		exit 1; \
	fi

ensure-pipenv:
	@ if [[ ! -d .venv ]]; then \
		make pipenv; \
	fi

ensure-pipenv-all:
	@for dir in . $(subenvs); do \
		make --no-print-directory -C $${dir} ensure-pipenv & \
	done; \
	wait

pipenv:
	pipenv clean
	pipenv run pip install pip==18.01

pipenv-all:
	@for dir in . $(subenvs); do \
		make --no-print-directory -C $${dir} pipenv & \
	done; \
	wait

install: ensure-pipenv
	pipenv update
	pipenv install --dev

install-all: ensure-pipenv-all
	@for dir in . $(subenvs); do \
		make --no-print-directory -C $${dir} install & \
	done; \
	wait

init: install

init-all: install-all


pytest:
	$(activate) python setup.py test

docker-pytest:
	@ for subenv in $(subenvs); do \
		make --no-print-directory -C $${subenv} pytest; \
	done

pytest-all: pytest docker-pytest

docker-coverage:
	@ for subenv in $(subenvs); do \
		make --no-print-directory -C $${subenv} coverage; \
	done

pytest-ff:
	$(activate) pytest scripts src -xs --ff


pylint:
	@ $(activate) pylint --rcfile=pylint.rc ${pylint_folders} || true
	@ for subenv in $(subenvs); do \
		make --no-print-directory -C $${subenv} pylint; \
	done

pylint-ci:
	@ $(activate) pylint --exit-zero --output-format=parseable --rcfile=pylint.rc --score=no ${pylint_folders}
	@ for subenv in $(subenvs); do \
		make --no-print-directory -C $${subenv} pylint-ci; \
	done

mypy:
	@# Only swallow checking errors (rc=1), not fatal problems (rc=2)
	@ $(activate) mypy ${pylint_folders} || test $$? -eq 1
#	for subenv in $(subenvs); do \
#		make --no-print-directory -C $${subenv} mypy; \
#	done

hadolint:
	@echo "hadolint --config=docker/hadolint.yml docker/*/Dockerfile"
	@# The pipe swallows return code, so no need for "|| true".
	@docker run --rm -i -v ${PWD}/docker:/docker:ro hadolint/hadolint hadolint --config=docker/hadolint.yml docker/*/Dockerfile | sed 's/:\([0-9]\+\) /:\1:0 /'

shellcheck:
	@# Only swallow checking errors (rc=1), not fatal problems (rc=2)
	docker run --rm -i -v ${PWD}:/mnt:ro koalaman/shellcheck -f gcc -e SC1090,SC1091 `find * -path terraform -prune -o -name '*.sh' -print` || test $$? -eq 1


# docker
docker-build:
	# best way we can find right now to pull remote image based services but skip 'local/services'
	docker-compose config | yq -r '.services[].image'  | grep -vE 'local/services|null' | xargs -n1 docker pull
	docker-compose build --pull api
	docker image list
ifndef DISABLE_PARALLEL_DOCKER_BUILD # macbooks struggle to build all images
	docker-compose build --pull --parallel
else
	docker-compose build --pull
endif


up:

	docker-compose $(compose_files) up -d

down:
	docker-compose down --remove-orphans

restart: down up


docker-clean:
	docker ps -qa --no-trunc --filter "status=exited" | xargs --no-run-if-empty docker rm
	docker images --filter "dangling=true" -q --no-trunc | xargs --no-run-if-empty docker rmi

# on jenkins agents
docker-clean-all: down docker-clean
	docker images -q --no-trunc | xargs --no-run-if-empty docker rmi -f
	docker volume prune -f
