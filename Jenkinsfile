pipeline {
    agent any

    environment {
        GIT_COMMIT_SHORT = ''
        CURRENT_BRANCH = ''
    }

    stages {

        stage('Identify Branch') {
            steps {
                script {
                    env.CURRENT_BRANCH = sh(
                        script: 'git rev-parse --abbrev-ref HEAD',
                        returnStdout: true
                    ).trim()

                    env.GIT_COMMIT_SHORT = sh(
                        script: 'git rev-parse --short=7 HEAD',
                        returnStdout: true
                    ).trim()

                    echo "======================================"
                    echo "Branch: ${env.CURRENT_BRANCH}"
                    echo "Build: ${env.BUILD_NUMBER}"
                    echo "Commit: ${env.GIT_COMMIT_SHORT}"
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
                    echo "======================================"
                    echo "Docker Build"
                    echo "Branch: $CURRENT_BRANCH"
                    echo "Build Number: $BUILD_NUMBER"
                    echo "Commit: $GIT_COMMIT_SHORT"
                    echo "======================================"

                    docker compose build \
                        --build-arg BUILD_NUMBER=$BUILD_NUMBER \
                        --build-arg GIT_COMMIT=$GIT_COMMIT_SHORT
                '''
            }
        }

        stage('Start Services - DEV') {
            when {
                expression {
                    env.CURRENT_BRANCH == 'dev'
                }
            }

            steps {
                sh '''
                    echo "Starting DEV services..."

                    docker compose up -d

                    sleep 5

                    docker compose ps
                '''
            }
        }

        stage('Integration Test - DEV') {
            when {
                expression {
                    env.CURRENT_BRANCH == 'dev'
                }
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
         * MAIN
         *
         * בשלב הזה אנחנו עדיין לא מבצעים Blue-Green מלא.
         * רק מכינים ומוודאים שהגרסה החדשה ניתנת להרצה.
         */

        stage('Prepare Blue-Green - MAIN') {
            when {
                expression {
                    env.CURRENT_BRANCH == 'main'
                }
            }

            steps {
                sh '''
                    echo "======================================"
                    echo "Preparing Blue-Green deployment"
                    echo "Build: $BUILD_NUMBER"
                    echo "Commit: $GIT_COMMIT_SHORT"
                    echo "======================================"

                    docker compose down --remove-orphans || true
                '''
            }
        }

        stage('Start New Version - MAIN') {
            when {
                expression {
                    env.CURRENT_BRANCH == 'main'
                }
            }

            steps {
                sh '''
                    echo "Starting new version for Blue-Green..."

                    docker compose up -d

                    sleep 5

                    docker compose ps
                '''
            }
        }

        stage('Health Check - MAIN') {
            when {
                expression {
                    env.CURRENT_BRANCH == 'main'
                }
            }

            steps {
                sh '''
                    echo "Checking WEB health..."

                    docker compose exec -T web \
                        wget -qO- http://localhost:3000/health

                    echo ""

                    echo "Checking API health..."

                    docker compose exec -T api \
                        wget -qO- http://localhost:3000/health

                    echo ""
                '''
            }
        }

        stage('Integration Test - MAIN') {
            when {
                expression {
                    env.CURRENT_BRANCH == 'main'
                }
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
         * Blue-Green אמיתי ייכנס כאן בשלב הבא:
         *
         * 1. גרסה חדשה עולה בפורט זמני
         * 2. Health Check
         * 3. Integration Test
         * 4. אם הצליח - Switch
         * 5. אם נכשל - מחיקת החדשה והשארת הישנה
         */

        stage('Blue-Green Switch - MAIN') {
            when {
                expression {
                    env.CURRENT_BRANCH == 'main'
                }
            }

            steps {
                echo "Blue-Green switch will be implemented in the next step."
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
            echo "Branch: ${env.CURRENT_BRANCH}"
            echo "Build: ${env.BUILD_NUMBER}"
            echo "Commit: ${env.GIT_COMMIT_SHORT}"
            echo "======================================"
        }

        failure {
            echo "======================================"
            echo "PIPELINE FAILED"
            echo "Branch: ${env.CURRENT_BRANCH}"
            echo "Build: ${env.BUILD_NUMBER}"
            echo "Commit: ${env.GIT_COMMIT_SHORT}"
            echo "======================================"
        }
    }
}