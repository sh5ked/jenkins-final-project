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

        stage('WEB Tests') {
            steps {
                dir('web') {
                    sh 'npm ci'
                    sh 'npm test -- --coverage'
                }
            }
        }

        stage('Docker Build') {
            steps {
                sh 'docker compose build'
            }
        }
    }
}