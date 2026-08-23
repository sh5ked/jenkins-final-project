pipeline {
    agent any

    stages {

        stage('Identify Branch') {
            steps {
                script {
                    echo "======================================"
                    echo "Branch: ${env.BRANCH_NAME}"
                    echo "Build: ${env.BUILD_NUMBER}"
                    echo "Commit: ${env.GIT_COMMIT}"
                    echo "======================================"
                }
            }
        }

        stage('API Tests') {
            steps {
                dir('api') {
                    sh 'npm ci'
                    sh '''
                        npm test -- \
                        --coverage \
                        --coverageReporters=text \
                        --coverageReporters=json-summary
                    '''
                }
            }
        }

        stage('API Coverage Gate') {
            steps {
                dir('api') {
                    sh '''
                        node -e "
                        const coverage = require('./coverage/coverage-summary.json');
                        const pct = coverage.total.statements.pct;

                        console.log('API statement coverage:', pct + '%');

                        if (pct < 80) {
                            console.error('API coverage is below 80%');
                            process.exit(1);
                        }

                        console.log('API coverage gate passed');
                        "
                    '''
                }
            }
        }

        stage('WEB Unit Tests') {
            steps {
                dir('web') {
                    sh 'npm ci'
                    sh '''
                        npm test -- \
                        --coverage \
                        --coverageReporters=text \
                        --coverageReporters=json-summary \
                        --runInBand \
                        tests/app-web.test.js
                    '''
                }
            }
        }

        stage('WEB Coverage Gate') {
            steps {
                dir('web') {
                    sh '''
                        node -e "
                        const coverage = require('./coverage/coverage-summary.json');
                        const pct = coverage.total.statements.pct;

                        console.log('WEB statement coverage:', pct + '%');

                        if (pct < 80) {
                            console.error('WEB coverage is below 80%');
                            process.exit(1);
                        }

                        console.log('WEB coverage gate passed');
                        "
                    '''
                }
            }
        }

        stage('Docker Build') {
            steps {
                sh '''
                    set -e

                    echo "======================================"
                    echo "Docker Build"
                    echo "Branch: ${BRANCH_NAME}"
                    echo "Build Number: ${BUILD_NUMBER}"
                    echo "Commit: ${GIT_COMMIT}"
                    echo "======================================"

                    docker compose build \
                        --build-arg BUILD_NUMBER=${BUILD_NUMBER} \
                        --build-arg GIT_COMMIT=${GIT_COMMIT}

                    docker tag \
                        jenkins-final-project-api:latest \
                        jenkins-final-project-api:${BUILD_NUMBER}

                    docker tag \
                        jenkins-final-project-web:latest \
                        jenkins-final-project-web:${BUILD_NUMBER}
                '''
            }
        }

        /*
         * DEV
         * בדיקות ובנייה בלבד.
         * השירותים עולים זמנית לצורך Integration Test,
         * אבל אין Deployment ואין NGINX.
         */
        stage('DEV Integration Environment') {
            when {
                branch 'dev'
            }

            steps {
                sh '''
                    set -e

                    export BUILD_NUMBER="${BUILD_NUMBER}"
                    export GIT_COMMIT="${GIT_COMMIT}"

                    docker compose up -d

                    docker network connect final-network jenkins || true

                    sleep 5

                    docker compose ps
                '''
            }
        }

        stage('DEV Integration Test') {
            when {
                branch 'dev'
            }

            steps {
                dir('web') {
                    sh '''
                        WEB_URL=http://web:3000 \
                        npx jest tests/integration.test.js --runInBand
                    '''
                }
            }
        }

        /*
         * MAIN - BLUE/GREEN
         */
        stage('Prepare Blue-Green Network') {
            when {
                branch 'main'
            }

            steps {
                sh '''
                    set -e

                    docker network inspect app-network >/dev/null 2>&1 || \
                        docker network create app-network

                    docker network connect app-network jenkins 2>/dev/null || true

                    mkdir -p deploy
                '''
            }
        }

        stage('Detect Active Color') {
            when {
                branch 'main'
            }

            steps {
                script {
                    def activeColor = sh(
                        script: '''
                            BLUE=$(docker ps -q -f name=^blue-web$)
                            GREEN=$(docker ps -q -f name=^green-web$)

                            if [ -n "$BLUE" ] && [ -n "$GREEN" ]; then
                                echo invalid
                            elif [ -n "$BLUE" ]; then
                                echo blue
                            elif [ -n "$GREEN" ]; then
                                echo green
                            else
                                echo none
                            fi
                        ''',
                        returnStdout: true
                    ).trim()

                    if (activeColor == 'invalid') {
                        error('Both blue and green are running. Refusing deployment.')
                    }

                    env.ACTIVE_COLOR = activeColor

                    if (activeColor == 'blue') {
                        env.NEW_COLOR = 'green'
                        env.NEW_PORT = '8087'
                    } else {
                        env.NEW_COLOR = 'blue'
                        env.NEW_PORT = '8086'
                    }

                    echo "Active color: ${env.ACTIVE_COLOR}"
                    echo "New color: ${env.NEW_COLOR}"
                    echo "Temporary port: ${env.NEW_PORT}"
                }
            }
        }

        stage('Start New Version') {
            when {
                branch 'main'
            }

            steps {
                sh '''
                    set -e

                    NEW="${NEW_COLOR}"
                    NEW_PORT="${NEW_PORT}"

                    echo "Starting new ${NEW} version..."

                    docker rm -f ${NEW}-web ${NEW}-api >/dev/null 2>&1 || true

                    docker run -d \
                        --name ${NEW}-api \
                        --network app-network \
                        -e BUILD_NUMBER="${BUILD_NUMBER}" \
                        -e GIT_COMMIT="${GIT_COMMIT}" \
                        jenkins-final-project-api:${BUILD_NUMBER}

                    docker run -d \
                        --name ${NEW}-web \
                        --network app-network \
                        -p ${NEW_PORT}:3000 \
                        -e API_URL="http://${NEW}-api:3000" \
                        -e BUILD_NUMBER="${BUILD_NUMBER}" \
                        -e GIT_COMMIT="${GIT_COMMIT}" \
                        jenkins-final-project-web:${BUILD_NUMBER}

                    docker ps --filter "name=${NEW}-"
                '''
            }
        }

        stage('Health Check New Version') {
            when {
                branch 'main'
            }

            steps {
                sh '''
                    set -e

                    NEW="${NEW_COLOR}"
                    SHORT_COMMIT="${GIT_COMMIT:0:7}"

                    echo "Waiting for API and WEB health..."

                    for i in $(seq 1 30); do

                        API_HEALTH=$(curl -fsS \
                            "http://${NEW}-api:3000/health" \
                            2>/dev/null || true)

                        WEB_HEALTH=$(curl -fsS \
                            "http://${NEW}-web:3000/health" \
                            2>/dev/null || true)

                        if [ -n "$API_HEALTH" ] && [ -n "$WEB_HEALTH" ]; then
                            break
                        fi

                        sleep 1
                    done

                    echo "API health:"
                    echo "$API_HEALTH"

                    echo "WEB health:"
                    echo "$WEB_HEALTH"

                    node - "$API_HEALTH" "$BUILD_NUMBER" "$SHORT_COMMIT" <<'NODE'
                    const health = JSON.parse(process.argv[2]);
                    const expectedBuild = process.argv[3];
                    const expectedCommit = process.argv[4];

                    if (health.status !== "ok") {
                        throw new Error("API status is not ok");
                    }

                    if (String(health.build) !== expectedBuild) {
                        throw new Error("API build stamp mismatch");
                    }

                    if (String(health.commit) !== expectedCommit) {
                        throw new Error("API commit stamp mismatch");
                    }
                    NODE

                    node - "$WEB_HEALTH" "$BUILD_NUMBER" "$SHORT_COMMIT" <<'NODE'
                    const health = JSON.parse(process.argv[2]);
                    const expectedBuild = process.argv[3];
                    const expectedCommit = process.argv[4];

                    if (health.status !== "ok") {
                        throw new Error("WEB status is not ok");
                    }

                    if (String(health.build) !== expectedBuild) {
                        throw new Error("WEB build stamp mismatch");
                    }

                    if (String(health.commit) !== expectedCommit) {
                        throw new Error("WEB commit stamp mismatch");
                    }
                    NODE

                    echo "New version health check passed."
                '''
            }
        }

        stage('Integration Test New Version') {
            when {
                branch 'main'
            }

            steps {
                dir('web') {
                    sh '''
                        WEB_URL=http://${NEW_COLOR}-web:3000 \
                        npx jest tests/integration.test.js --runInBand
                    '''
                }
            }
        }

        stage('Prepare NGINX') {
            when {
                branch 'main'
            }

            steps {
                sh '''
                    set -e

                    NEW="${NEW_COLOR}"
                    NGINX="frontend-nginx"

                    sed "s/__ACTIVE_WEB__/${NEW}-web/g" \
                        nginx/nginx.conf.template \
                        > deploy/nginx.active.conf

                    NGINX_EXISTS=$(docker ps -aq -f name=^${NGINX}$)

                    if [ -z "$NGINX_EXISTS" ]; then

                        echo "First deployment: creating NGINX container."

                        docker create \
                            --name ${NGINX} \
                            --network app-network \
                            -p 8085:80 \
                            nginx:alpine

                        docker cp \
                            deploy/nginx.active.conf \
                            ${NGINX}:/etc/nginx/nginx.conf

                        docker start ${NGINX}

                    else

                        echo "Existing NGINX detected."

                        docker cp \
                            ${NGINX}:/etc/nginx/nginx.conf \
                            deploy/nginx.previous.conf

                        docker cp \
                            deploy/nginx.active.conf \
                            ${NGINX}:/etc/nginx/nginx.conf

                        docker exec ${NGINX} nginx -t
                        docker exec ${NGINX} nginx -s reload

                    fi
                '''
            }
        }

        stage('Verify Traffic Switch') {
            when {
                branch 'main'
            }

            steps {
                sh '''
                    set -e

                    echo "Testing stable public endpoint through NGINX..."

                    for i in $(seq 1 20); do
                        RESPONSE=$(curl -fsS http://frontend-nginx/health 2>/dev/null || true)

                        if [ -n "$RESPONSE" ]; then
                            echo "$RESPONSE"
                            break
                        fi

                        sleep 1
                    done

                    SHORT_COMMIT="${GIT_COMMIT:0:7}"

                    node - "$RESPONSE" "$BUILD_NUMBER" "$SHORT_COMMIT" <<'NODE'
                    const health = JSON.parse(process.argv[2]);
                    const expectedBuild = process.argv[3];
                    const expectedCommit = process.argv[4];

                    if (health.status !== "ok") {
                        throw new Error("NGINX returned a non-ok health response");
                    }

                    if (String(health.build) !== expectedBuild) {
                        throw new Error("NGINX active version has unexpected build number");
                    }

                    if (String(health.commit) !== expectedCommit) {
                        throw new Error("NGINX active version has unexpected commit");
                    }
                    NODE

                    echo "Traffic switch verified successfully."
                '''
            }
        }

        stage('Remove Old Version') {
            when {
                allOf {
                    branch 'main'
                    expression {
                        env.ACTIVE_COLOR != 'none'
                    }
                }
            }

            steps {
                sh '''
                    set -e

                    OLD="${ACTIVE_COLOR}"
                    NEW="${NEW_COLOR}"

                    echo "Stopping old ${OLD} version..."

                    docker rm -f ${OLD}-web ${OLD}-api

                    echo "Blue-Green deployment completed."
                    echo "Active version: ${NEW}"
                '''
            }
        }
    }

    post {

        always {
            script {
                if (env.BRANCH_NAME == 'dev') {
                    sh '''
                        docker compose down --remove-orphans || true
                    '''
                }

                if (env.BRANCH_NAME == 'main') {
                    sh '''
                        echo "MAIN deployment resources are intentionally kept alive."
                    '''
                }
            }
        }

        success {
            echo "======================================"
            echo "PIPELINE SUCCESS"
            echo "Branch: ${env.BRANCH_NAME}"
            echo "Build: ${env.BUILD_NUMBER}"
            echo "Commit: ${env.GIT_COMMIT}"
            echo "======================================"
        }

        failure {
            echo "======================================"
            echo "PIPELINE FAILED"
            echo "Branch: ${env.BRANCH_NAME}"
            echo "Build: ${env.BUILD_NUMBER}"
            echo "Commit: ${env.GIT_COMMIT}"
            echo "======================================"

            /*
             * חשוב:
             * ב-MAIN אין כאן docker compose down.
             * אם Health/Integration נכשלו, הישן נשאר חי.
             */

            script {
                if (env.BRANCH_NAME == 'main' && env.NEW_COLOR) {
                    sh '''
                        echo "Removing failed new version only..."

                        docker rm -f \
                            ${NEW_COLOR}-web \
                            ${NEW_COLOR}-api \
                            2>/dev/null || true

                        if [ "${ACTIVE_COLOR}" != "none" ] && \
                           [ -f deploy/nginx.previous.conf ]; then

                            echo "Restoring previous NGINX configuration..."

                            docker cp \
                                deploy/nginx.previous.conf \
                                frontend-nginx:/etc/nginx/nginx.conf \
                                2>/dev/null || true

                            docker exec \
                                frontend-nginx \
                                nginx -t \
                                2>/dev/null || true

                            docker exec \
                                frontend-nginx \
                                nginx -s reload \
                                2>/dev/null || true
                        fi
                    '''
                }
            }
        }
    }
}