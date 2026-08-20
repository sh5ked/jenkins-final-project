pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = "jenkins-final-project"
        WEB_PORT = "8085"
    }

    stages {

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

        /*
         * DEV:
         * Build only.
         *
         * MAIN:
         * Build and continue to deployment.
         */
        stage('Docker Build') {
            steps {
                sh '''
                    export BUILD_NUMBER=${BUILD_NUMBER}
                    export GIT_COMMIT=$(git rev-parse HEAD)

                    echo "======================================"
                    echo "Branch: ${BRANCH_NAME}"
                    echo "Build Number: ${BUILD_NUMBER}"
                    echo "Git Commit: ${GIT_COMMIT}"
                    echo "======================================"

                    docker compose build \
                        --build-arg BUILD_NUMBER=${BUILD_NUMBER} \
                        --build-arg GIT_COMMIT=${GIT_COMMIT}
                '''
            }
        }

        stage('Start Services - DEV') {
            when {
                branch 'dev'
            }

            steps {
                sh '''
                    echo "DEV branch detected."
                    echo "Starting services for integration testing..."

                    export BUILD_NUMBER=${BUILD_NUMBER}
                    export GIT_COMMIT=$(git rev-parse HEAD)

                    docker compose up -d

                    sleep 5

                    docker compose ps
                '''
            }
        }

        stage('Integration Test - DEV') {
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
         * MAIN ONLY
         *
         * This is the preparation stage for Blue-Green deployment.
         * The old version remains untouched.
         */
        stage('Prepare Blue-Green - MAIN') {
            when {
                branch 'main'
            }

            steps {
                sh '''
                    echo "======================================"
                    echo "MAIN branch detected"
                    echo "Preparing Blue-Green deployment"
                    echo "======================================"

                    export BUILD_NUMBER=${BUILD_NUMBER}
                    export GIT_COMMIT=$(git rev-parse HEAD)

                    echo "Build Number: ${BUILD_NUMBER}"
                    echo "Git Commit: ${GIT_COMMIT}"

                    docker compose config
                '''
            }
        }

        /*
         * MAIN ONLY
         *
         * Start the new version on the temporary/internal
         * Compose network.
         *
         * We do NOT replace the currently running version here.
         */
        stage('Start New Version - MAIN') {
            when {
                branch 'main'
            }

            steps {
                sh '''
                    echo "Starting NEW version..."

                    export BUILD_NUMBER=${BUILD_NUMBER}
                    export GIT_COMMIT=$(git rev-parse HEAD)

                    docker compose up -d --build

                    sleep 5

                    docker compose ps
                '''
            }
        }

        /*
         * MAIN ONLY
         *
         * First health check of the new version.
         */
        stage('Health Check - MAIN') {
            when {
                branch 'main'
            }

            steps {
                sh '''
                    echo "Checking new WEB version..."

                    docker compose exec -T web \
                        wget -qO- http://localhost:3000/health

                    echo ""
                    echo "Checking new API version..."

                    docker compose exec -T api \
                        wget -qO- http://localhost:3000/health

                    echo ""
                    echo "Health checks passed."
                '''
            }
        }

        /*
         * MAIN ONLY
         *
         * Integration test against the new version.
         */
        stage('Integration Test - MAIN') {
            when {
                branch 'main'
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
         * MAIN ONLY
         *
         * This is intentionally left as a separate stage.
         * The actual traffic switch will be implemented here
         * in the next step.
         */
        stage('Blue-Green Switch - MAIN') {
            when {
                branch 'main'
            }

            steps {
                sh '''
                    echo "======================================"
                    echo "BLUE-GREEN VALIDATION PASSED"
                    echo "======================================"

                    echo "New version is healthy."
                    echo "Integration test passed."
                    echo ""
                    echo "Traffic switch stage reached successfully."
                    echo "Actual traffic switch will be implemented here."
                '''
            }
        }
    }

    post {
        always {
            sh '''
                echo "Cleaning temporary Compose resources..."

                docker compose down --remove-orphans || true
            '''
        }

        success {
            echo "======================================"
            echo "PIPELINE SUCCESS"
            echo "Branch: ${BRANCH_NAME}"
            echo "Build: ${BUILD_NUMBER}"
            echo "======================================"
        }

        failure {
            echo "======================================"
            echo "PIPELINE FAILED"
            echo "Branch: ${BRANCH_NAME}"
            echo "Build: ${BUILD_NUMBER}"
            echo "======================================"
        }
    }
}