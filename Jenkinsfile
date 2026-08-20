pipeline {
    agent any

    stages {

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

        stage('Start Services') {
            steps {
                sh '''
                    export BUILD_NUMBER=${BUILD_NUMBER}
                    export GIT_COMMIT=$(git rev-parse HEAD)

                    echo "Build Number: $BUILD_NUMBER"
                    echo "Git Commit: $GIT_COMMIT"

                    docker compose up -d --build

                    docker network connect jenkins-final-project_final-network jenkins || true

                    docker compose ps

                    sleep 5
                '''
            }
        }

        stage('Integration Test') {
            steps {
                dir('web') {
                    sh '''
                        WEB_URL=http://web:3000 \
                        npx jest tests/integration.test.js --runInBand
                    '''
                }
            }
        }
    }

    post {
        always {
            sh '''
                docker compose down || true
            '''
        }
    }
}