export GOOGLE_SERVICE_ACCOUNT="REMOVED_GCP_SERVICE_ACCOUNT_KEY"
yarn glogin
yarn add @ikomida/shared-backend@latest
docker build -t us-central1-docker.pkg.dev/ikomida-prod/docker/contracts-microservice-image:latest . --build-arg GOOGLE_SERVICE_ACCOUNT="$env:GOOGLE_SERVICE_ACCOUNT"  --build-arg NODEENV=devlopment $nocache
docker push us-central1-docker.pkg.dev/ikomida-prod/docker/contracts-microservice-image:latest
kubectl -n ikomida delete deploy contracts-microservice
$prod = $false
if($args.count -gt 1){
    $prod=$args[1] -eq "prod"
}
if($prod){
    kubectl apply -f k8s
    }else{
    kubectl apply -f k8s-dev
}