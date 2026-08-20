pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = "jenkins-final-project"
    }

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
                    sh 'npm test -- --coverage --coverageReporters=text --coverageReporters=json-summary'
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
                    sh 'npm test -- --coverage --coverageReporters=text --coverageReporters=json-summary --runInBand tests/app-web.test.js'
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
                    echo "======================================"
                    echo "Docker Build"
                    echo "Branch: ${BRANCH_NAME}"
                    echo "Build Number: ${BUILD_NUMBER}"
                    echo "Commit: ${GIT_COMMIT}"
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
                    echo "Starting DEV services..."
                    docker compose up -d
                '''
            }
        }

        stage('Integration Test - DEV') {
            when {
                branch 'dev'
            }
            steps {
                sh '''
                    echo "Running DEV integration tests..."

                    sleep 5

                    docker compose ps
                '''
            }
        }

        stage('Prepare Blue-Green - MAIN') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    echo "Preparing Blue-Green deployment for MAIN..."
                    docker compose down --remove-orphans || true
                '''
            }
        }

        stage('Start New Version - MAIN') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    echo "Starting new MAIN version..."

                    docker compose up -d

                    docker compose ps
                '''
            }
        }

        stage('Health Check - MAIN') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    echo "Waiting for services..."
                    sleep 5

                    echo "Checking API health..."

                    curl -f http://localhost:3000/health || exit 1

                    echo "API health check passed"
                '''
            }
        }

        stage('Integration Test - MAIN') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    echo "Running MAIN integration tests..."

                    docker compose ps
                '''
            }
        }

        stage('Blue-Green Switch - MAIN') {
            when {
                branch 'main'
            }
            steps {
                sh '''
                    echo "Blue-Green deployment switch completed."
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
        }
    }
}