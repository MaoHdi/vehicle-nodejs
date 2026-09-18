@Library('utils@master') _
import com.lmig.intl.cloud.jenkins.util.EnvConfigUtil

def envUtil = new EnvConfigUtil()
countryParams = envUtil.getCountryEnvDetails(env.JOB_NAME)

pipeline {
  agent {
    docker { 
      image 'jfrog.hdicolombia.com.co/pod-templates-latam/pipeline2.0.x:latest'
      args '''
        -v /usr/local/aws-cli/:/usr/local/aws-cli/ 
      '''
    }
  }

  parameters {
    string(name: 'Ref', defaultValue: 'refs/heads/', description: 'Enter Branch Name. Example: master, develop, feature/*, release/*, hotfix/*', trim: true)
    string(name: 'Email', defaultValue: '', description: 'Enter Email notification. Example: pperez@mail.com', trim: true)
  }

  options { 
    timestamps()
    timeout(time: 3, unit: 'HOURS')
    disableConcurrentBuilds()
    office365ConnectorWebhooks([[
      name: 'JenkinsCI/CDHDI',
      url: 'https://hdiseguroscom.webhook.office.com/webhookb2/f0ce16c7-8cf8-44df-b229-bffb9b2fd76e@35681c81-d5eb-4c9e-8171-6e66bc263a82/JenkinsCI/74bd0a0dc8934a44a0b84da423ec6f86/8a138926-75ef-4b10-aad4-cd44288b5ebe/V2-QiF8q9a0wTDRrLxp_KlwXmxvPr84SSAuv0Xwl8tagQ1',
      notifySuccess: false,
      notifyAborted: true,
      notifyNotBuilt: true,
      notifyUnstable: true,
      notifyFailure: true,
      notifyBackToNormal: false,
      notifyRepeatedFailure: true,
      timeout: 30000
    ]])
  }

  environment {
    HOME = "${env.WORKSPACE}"
    STAGE = countryParams.countryEnv.toLowerCase()
    AWS_ACCOUNT_ID = null
    VERSION = null
    REPO_NAME = null
    AWS_REGION = "us-east-1"
    LAMBDAS = null
  }

  stages {
    stage('Continuos Integration') {
      steps {
        dir('ci-pipelines') {
          git branch: 'master', url: 'https://github.com/hdiseguroscol/co-hdi-jenkins-pipelines.git', credentialsId: 'Github-HDI'            
        }
        load 'ci-pipelines/lambda/JenkinsfileNodeCI'
      }
    }

    stage('Continuos Deployment') {
      steps {
        load 'ci-pipelines/lambda/JenkinsfileNodeCD'
      }
    }
  }

  post {
    always {
      script {
        notification(emails: "${params.Email}")
        cleanWs()
        deleteDir()
      }
    }
  }
}