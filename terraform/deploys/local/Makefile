

terraform:
	terraform init
	terraform apply -auto-approve

destroy:
	terraform destroy -auto-approve

plan:
	terraform plan

clean:
	rm .terraform.plan 2>/dev/null | true
	rm -r .terraform 2>/dev/null | true
	rm -r terraform.tfstate.d 2>/dev/null | true
	rm errored.tfstate 2>/dev/null | true
	rm terraform.tfstate | true
	rm terraform.tfstate.backup | true
