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
                        const total = coverage.total;
                        const values = [
                            total.statements.pct,
                            total.branches.pct,
                            total.functions.pct,
                            total.lines.pct
                        ];
                        const min = Math.min(...values);
                        console.log('API minimum coverage:', min + '%');
                        if (min < 80) {
                            console.error('API coverage is below 80%');
                            process.exit(1);
                        }
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
                        const total = coverage.total;
                        const values = [
                            total.statements.pct,
                            total.branches.pct,
                            total.functions.pct,
                            total.lines.pct
                        ];
                        const min = Math.min(...values);
                        console.log('WEB minimum coverage:', min + '%');
                        if (min < 80) {
                            console.error('WEB coverage is below 80%');
                            process.exit(1);
                        }
                        "
                    '''
                }
            }
        }

        stage('Start Services') {
            steps {
                sh 'docker compose up -d --build'
                sh 'docker network connect jenkins-final-project_final-network jenkins || true'
                sh 'docker compose ps'
            }
        }

        stage('Integration Test') {
            steps {
                dir('web') {
                    sh 'WEB_URL=http://final-web:3000 npx jest tests/integration.test.js --runInBand'
                }
            }
        }
    }

    post {
        always {
            sh 'docker compose down || true'
        }
    }
}