pipeline {
    agent any

    stages {

        stage('API Tests') {
            steps {
                dir('api') {
                    sh 'npm ci'
                    sh 'npm test -- --coverage'
                }
            }
        }

        stage('WEB Unit Tests') {
            steps {
                dir('web') {
                    sh 'npm ci'
                    sh 'npm test -- --coverage --runInBand tests/app-web.test.js'
                }
            }
        }

        stage('Start Services') {
            steps {
                sh 'docker compose up -d --build'
                sh 'docker compose ps'
            }
        }

        stage('Integration Test') {
            steps {
                dir('web') {
                    sh 'WEB_URL=http://localhost:8085 npx jest tests/integration.test.js --runInBand'
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