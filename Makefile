SHELL := /bin/bash
########################################################################################################################
##
## Makefile for managing sync async
##
########################################################################################################################
compose_files = ${COMPOSE_FILES}
pwd := ${PWD}
dirname := $(notdir $(patsubst %/,%,$(CURDIR)))
features = features
proxies :=sync-wrap async-slowapp
modules :=sync-wrap async-slowapp

list:
	@grep '^[^#[:space:]].*:' Makefile

guard-%:
	@ if [ "${${*}}" = "" ]; then \
		echo "Environment variable $* not set"; \
		exit 1; \
	fi

clean: clean-build clean-dist clean-reports
	rm -rf ./build || true
	@for dir in $(modules); do \
		make --no-print-directory -C docker/$${dir} clean & \
	done; \
	wait

install:
	@for dir in $(modules); do \
		make --no-print-directory -C docker/$${dir} install & \
	done; \
	wait

reinstall: clean install

clean-build:
	rm -rf ./build || true

clean-dist:
	rm -rf ./dist || true

clean-reports:
	rm -rf ./reports || true

ensure-utils:
	@if [[ ! -d ./utils ]]; then \
		git clone https://github.com/NHSDigital/api-management-utils.git utils; \
	fi
	make --no-print-directory -C utils install


build: clean-build ensure-utils
	@for dir in $(modules); do \
		make --no-print-directory -C docker/$${dir} build & \
	done; \
	for dir in $(proxies); do \
		make --no-print-directory -C proxies/$${dir} build & \
	done; \
	wait

build-proxy: build

dist: clean-dist build
	mkdir -p dist/proxies
	cp -R build/. dist/proxies
	cp -R terraform dist
	cp -R utils dist
	rm -rf dist/utils/.git
#	cp -R tests dist

test: clean-reports
	@for dir in $(modules); do \
		make --no-print-directory -C docker/$${dir} test;\
	done;

test-report: clean-reports
	@for dir in $(modules); do \
		make --no-print-directory -C docker/$${dir} test-report; \
	done;

hadolint:
	@echo "hadolint --config=docker/hadolint.yml docker/*/Dockerfile"
	@# The pipe swallows return code, so no need for "|| true".
	@docker run --rm -i -v ${PWD}/docker:/docker:ro hadolint/hadolint hadolint --config=docker/hadolint.yml docker/*/Dockerfile | sed 's/:\([0-9]\+\) /:\1:0 /'

shellcheck:
	@# Only swallow checking errors (rc=1), not fatal problems (rc=2)
	docker run --rm -i -v ${PWD}:/mnt:ro koalaman/shellcheck -f gcc -e SC1090,SC1091 `find * -prune -o -name '*.sh' -print` || test $$? -eq 1