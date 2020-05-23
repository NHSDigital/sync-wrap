SHELL := /bin/bash
dirname := $(notdir $(patsubst %/,%,$(CURDIR)))

list:
	@grep '^[^#[:space:]].*:' Makefile

build:
	rm -rf ../../build/$(dirname) || true
	mkdir -p ../../build/$(dirname)
	cp -r ./apiproxy ../../build/$(dirname)
	rsync -av --include={'package*.json','src','*.js'} --exclude="*" --exclude={'*.spec.js'} ./ ../../build/$(dirname)/apiproxy/resources/hosted

deploy: build
	cd ../../build/$(dirname) && apigeetool deployproxy -V -o nhsd-nonprod -e internal-dev -n $(dirname) -t $$(get_token)

undeploy:
	apigeetool undeploy -V -o nhsd-nonprod -e internal-dev -n $(dirname) -t $$(get_token)

delete:
	apigeetool delete -V -o nhsd-nonprod -n $(dirname) -t $$(get_token)

clean:
	rm -rf ./node_modules

install:
	npm install --dev

test:
	NODE_ENV=test npx mocha