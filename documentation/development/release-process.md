# Процесс релиза

## Обзор
Данный документ описывает полный процесс релиза для проекта VBallAgregator, включающий подготовку, тестирование, развертывание и мониторинг в продакшене.

## Содержание
- [Жизненный цикл релиза](#жизненный-цикл-релиза)
- [Подготовка к релизу](#подготовка-к-релизу)
- [Тестирование релиза](#тестирование-релиза)
- [Развертывание](#развертывание)
- [Post-release действия](#post-release-действия)
- [Rollback процедуры](#rollback-процедуры)
- [Мониторинг и алертинг](#мониторинг-и-алертинг)
- [Документация релиза](#документация-релиза)

## Жизненный цикл релиза

### Фазы релиза
```
Фазы релиза:
    
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Планирование│─▶│ Подготовка  │─▶│ Тестирование│─▶│Развертывание│─▶│ Мониторинг  │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
     │                 │                 │                 │               │
     │                 │                 │                 │               │
- Sprint planning  - Code freeze     - Integration      - Blue/Green     - Production
- Version bump     - Release branch   - QA testing       - Health checks  monitoring  
- Change log       - Documentation    - Performance      - Smoke tests    - Rollback
```

### Типы релизов

#### Regular Release (Обычный релиз)
- **Частота**: Каждые 2-4 недели
- **Размер**: Средний набор функций
- **Тестирование**: Полный цикл тестирования
- **Уведомление**: За 1-2 дня до релиза

#### Hotfix Release (Экстренное исправление)
- **Частота**: По необходимости
- **Размер**: Только критические исправления
- **Тестирование**: Minimal testing
- **Уведомление**: Немедленно

#### Security Release (Безопасностный релиз)
- **Частота**: По необходимости
- **Причина**: Критические уязвимости безопасности
- **Приоритет**: Максимальный
- **Тестирование**: Security testing + regression

## Подготовка к релизу

### Планирование релиза

#### Sprint planning meeting
```markdown
## Sprint Planning Agenda

### Review прошедшего спринта
- [ ] Статус завершенных задач
- [ ] Burn-down chart анализ
- [ ] Препятствия и проблемы

### Планирование нового спринта
- [ ] Product Backlog grooming
- [ ] Story pointing
- [ ] Definition of Done
- [ ] Выбор задач для следующего релиза

### Определение Release scope
- [ ] Критический путь
- [ ] Risk assessment
- [ ] Resource allocation
- [ ] Timeline определение
```

#### Release planning checklist
```bash
# scripts/release-planning-checklist.sh
echo "Release Planning Checklist"
echo "==========================="

checklist_items=(
  "Product Owner утвердил scope релиза"
  "Все user stories в 'Ready for Development'"
  "Техническая архитектура утверждена"
  "QA план создан и утвержден"
  "Версия релиза определена"
  "Release notes draft создан"
  "Среда staging готова"
  "Команда уведомлена о timeline"
  "Rollback план создан"
  "Monitoring alerts настроены"
)

for item in "${checklist_items[@]}"; do
  echo "☐ $item"
done
```

### Code freeze

#### Процедура freeze
```bash
# scripts/code-freeze.sh
#!/bin/bash

RELEASE_VERSION=$1
RELEASE_DATE=$(date +%Y-%m-%d)

echo "Starting code freeze for version $RELEASE_VERSION"
echo "Release date: $RELEASE_DATE"

# Создание release ветки
git checkout develop
git pull origin develop
git checkout -b release/$RELEASE_VERSION

# Обновление версии
npm version $RELEASE_VERSION --no-git-tag-version

# Создание commit для version bump
git add package.json package-lock.json
git commit -m "chore: bump version to $RELEASE_VERSION"

# Уведомление команды
echo "Code freeze started for version $RELEASE_VERSION"
echo "All team members should stop pushing to develop branch"
echo "Use release/$RELEASE_VERSION branch for final changes"
```

#### Правила Code Freeze
- **Запрещено**: Добавление новых функций
- **Разрешено**: Критические багфиксы (только с approval)
- **Рекомендуется**: Финальная документация и тестирование
- **Обязательно**: Обновление changelog

### Подготовка документации

#### Release Notes Template
```markdown
# Release v1.2.0 - "Volleyball Master"

## Release Information
- **Release Date**: 2025-11-30
- **Release Type**: Regular Release
- **Sprint**: Sprint 6 (2025-11-16 - 2025-11-29)
- **Release Manager**: @ivan-petrov
- **Code Freeze**: 2025-11-28 18:00

## 🎉 New Features

### User Registration System
- Telegram bot registration flow
- User profile management
- Level-based player categorization
- Welcome notifications

**Impact**: New users can now easily register through Telegram bot

### Payment Integration
- Card payment processing
- Cash payment support
- Payment history tracking
- Automated receipts

**Impact**: Users can pay for games online, reducing manual processes

### Game Management
- Advanced game filtering
- Automated waitlist management
- Game status tracking
- Organizer dashboard

**Impact**: Better game organization and player experience

## 🐛 Bug Fixes

- **FIX-001**: Fixed Telegram user data parsing for users with special characters
- **FIX-002**: Resolved timezone issues in game scheduling
- **FIX-003**: Fixed payment callback handling for failed transactions
- **FIX-004**: Corrected notification timing for game reminders

## ⚡ Performance Improvements

- Optimized database queries for game listings (60% faster)
- Reduced API response time by 40%
- Implemented Redis caching for user sessions
- Improved image upload performance

## 🔧 Technical Changes

### Database
- Added `payments` table for transaction tracking
- Added `user_preferences` table for notification settings
- Updated `games` table with new indexing

### API
- New `/api/v1/payments/*` endpoints
- Enhanced `/api/v1/games/*` with filtering
- Improved error responses with detailed messages

### Infrastructure
- Migrated to PostgreSQL 15
- Updated Node.js to v18 LTS
- Enhanced logging with structured format

## 📊 Migration Notes

### Database Migration
```bash
npm run db:migrate:up
```

**Migration Time**: ~5 minutes  
**Downtime**: None (online migration)  
**Rollback**: Available via `npm run db:migrate:down`

### Breaking Changes
- `/api/v1/users/register` endpoint deprecated, use `/api/v1/auth/telegram`
- Response format changed for error messages
- Telegram Bot Token validation tightened

### Deprecations
- Legacy payment endpoints (remove in v2.0)
- Old user registration flow (remove in v1.3)

## 🚀 Deployment Instructions

### Pre-deployment
- [ ] Backup production database
- [ ] Prepare staging environment
- [ ] Notify team of deployment window
- [ ] Prepare rollback procedures

### Deployment Steps
1. Deploy to staging and verify
2. Run full test suite
3. Deploy to production (blue-green deployment)
4. Monitor health checks
5. Switch traffic to new version
6. Verify functionality with smoke tests

### Post-deployment
- [ ] Monitor key metrics for 2 hours
- [ ] Check error rates and performance
- [ ] Validate critical user journeys
- [ ] Send release announcement

## 👥 Contributors

Special thanks to all contributors:

- @ivan-petrov - Payment system and user registration
- @maria-smirnova - Game management features
- @alex-kozlov - Performance optimizations
- @anna-volkov - QA testing and documentation
- @dmitry-petrov - Infrastructure and DevOps

## 📈 Metrics

### Expected Impact
- User registration: +150% (estimated)
- Game creation: +25% (estimated)
- Payment completion: +40% (estimated)
- System uptime: 99.9%

### KPIs to Monitor
- Registration conversion rate
- Game completion rate
- Payment success rate
- API response time
- Error rate

## 🔗 Links

- [Changelog](../CHANGELOG.md)
- [API Documentation](../architecture/api-reference.md)
- [Deployment Guide](../guides/deployment-guide.md)
- [Monitoring Dashboard](https://monitoring.vball-aggregator.com)

## 🐛 Known Issues

- **KNOWN-001**: Push notifications may have 1-2 minute delay during peak hours
- **KNOWN-002**: Large game images (>5MB) may upload slowly

## 💬 Feedback

We value your feedback! Please report issues or suggestions:

- GitHub Issues: [Report a bug](https://github.com/vball-aggregator/issues)
- Telegram Feedback Bot: [@VBallFeedbackBot](https://t.me/VBallFeedbackBot)
- Email: feedback@vball-aggregator.com

---

**Next Release**: v1.2.1 (Hotfix) - Planned for 2025-12-05
```

## Тестирование релиза

### Pre-release testing

#### Test plan execution
```typescript
// tests/release/release-test-plan.ts
export interface ReleaseTestPlan {
  version: string
  releaseDate: string
  features: TestFeature[]
  testEnvironment: Environment
  testingTeam: string[]
  estimatedDuration: number // hours
}

interface TestFeature {
  name: string
  testCases: TestCase[]
  priority: 'critical' | 'high' | 'medium' | 'low'
  owner: string
}

interface TestCase {
  id: string
  description: string
  steps: string[]
  expectedResult: string
  automated: boolean
  status: 'pending' | 'passed' | 'failed' | 'skipped'
}

export class ReleaseTestManager {
  async executeReleaseTestPlan(plan: ReleaseTestPlan): Promise<TestResults> {
    console.log(`Starting release testing for version ${plan.version}`)
    
    const results: TestResults = {
      passed: 0,
      failed: 0,
      skipped: 0,
      total: 0
    }

    // Execute critical tests first
    for (const feature of plan.features.filter(f => f.priority === 'critical')) {
      await this.runFeatureTests(feature, results)
    }

    // Execute high priority tests
    for (const feature of plan.features.filter(f => f.priority === 'high')) {
      await this.runFeatureTests(feature, results)
    }

    // Execute medium and low priority if time permits
    if (results.failed === 0) {
      for (const feature of plan.features.filter(f => ['medium', 'low'].includes(f.priority))) {
        await this.runFeatureTests(feature, results)
      }
    }

    return results
  }

  private async runFeatureTests(feature: TestFeature, results: TestResults): Promise<void> {
    console.log(`Testing feature: ${feature.name}`)
    
    for (const testCase of feature.testCases) {
      results.total++
      
      try {
        const passed = await this.executeTestCase(testCase)
        if (passed) {
          results.passed++
        } else {
          results.failed++
          console.error(`❌ Test failed: ${testCase.id} - ${testCase.description}`)
        }
      } catch (error) {
        results.failed++
        console.error(`💥 Test error: ${testCase.id} - ${error.message}`)
      }
    }
  }

  private async executeTestCase(testCase: TestCase): Promise<boolean> {
    if (testCase.automated) {
      return await this.runAutomatedTest(testCase)
    } else {
      return await this.runManualTest(testCase)
    }
  }

  private async runAutomatedTest(testCase: TestCase): Promise<boolean> {
    // Execute automated test
    return true // Mock result
  }

  private async runManualTest(testCase: TestCase): Promise<boolean> {
    // Mark for manual execution
    console.log(`🧪 Manual test required: ${testCase.id}`)
    return true // Manual tester will update status
  }
}
```

### Smoke testing
```bash
# scripts/smoke-tests.sh
#!/bin/bash

API_BASE_URL=${API_BASE_URL:-"http://localhost:3000"}
TELEGRAM_BOT_TOKEN=${TELEGRAM_BOT_TOKEN:-"test_token"}

echo "Starting smoke tests..."
echo "API Base URL: $API_BASE_URL"

# Health check
echo "Testing health endpoint..."
response=$(curl -s -o /dev/null -w "%{http_code}" $API_BASE_URL/health)
if [ "$response" != "200" ]; then
  echo "❌ Health check failed"
  exit 1
fi
echo "✅ Health check passed"

# API functionality
echo "Testing user registration..."
user_data='{
  "telegramId": 123456789,
  "firstName": "SmokeTest",
  "level": "intermediate"
}'

response=$(curl -s -w "\n%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d "$user_data" \
  $API_BASE_URL/api/v1/users)

http_code=$(echo "$response" | tail -n1)
if [ "$http_code" != "201" ]; then
  echo "❌ User registration failed"
  exit 1
fi
echo "✅ User registration passed"

# Database connectivity
echo "Testing database connectivity..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$queryRaw\`SELECT 1\`
  .then(() => {
    console.log('✅ Database connection successful');
    process.exit(0);
  })
  .catch(err => {
    console.log('❌ Database connection failed:', err.message);
    process.exit(1);
  });
"

echo "🎉 All smoke tests passed!"
```

### Performance testing
```typescript
// tests/performance/load-tests.ts
import { check, sleep } from 'k6'
import { Rate } from 'k6/metrics'

export let errorRate = new Rate('errors')

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests must complete below 2s
    http_req_failed: ['rate<0.1'],     // Error rate must be below 10%
    errors: ['rate<0.1'],
  },
}

const API_BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000'

export default function () {
  // Test 1: Get available games
  let getGamesResponse = http.get(`${API_BASE_URL}/api/v1/games`)
  check(getGamesResponse, {
    'games status is 200': (r) => r.status === 200,
    'games response time OK': (r) => r.timings.duration < 1000,
  }) || errorRate.add(1)

  sleep(1)

  // Test 2: User registration (if user doesn't exist)
  let registrationData = {
    telegramId: Math.floor(Math.random() * 1000000),
    firstName: `LoadTest${Math.floor(Math.random() * 1000)}`,
    level: 'intermediate'
  }

  let registrationResponse = http.post(
    `${API_BASE_URL}/api/v1/users`,
    JSON.stringify(registrationData),
    { headers: { 'Content-Type': 'application/json' } }
  )

  check(registrationResponse, {
    'registration status is 201 or 409': (r) => r.status === 201 || r.status === 409,
    'registration response time OK': (r) => r.timings.duration < 2000,
  }) || errorRate.add(1)

  sleep(2)
}
```

## Развертывание

### Pre-deployment checklist
```bash
# scripts/pre-deployment-checklist.sh
#!/bin/bash

echo "🔍 Pre-deployment Checklist"
echo "============================"

checklist=(
  "✅ All tests passed on CI"
  "✅ Code review completed and approved"
  "✅ Release notes finalized"
  "✅ Database migration scripts ready"
  "✅ Environment variables prepared"
  "✅ SSL certificates valid"
  "✅ Monitoring alerts configured"
  "✅ Rollback plan documented"
  "✅ Team notified of deployment window"
  "✅ Staging deployment successful"
)

for item in "${checklist[@]}"; do
  echo "$item"
  read -p "Press Enter to confirm or 'n' to mark as not done: " -r
  if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "❌ Pre-deployment check failed: $item"
    exit 1
  fi
done

echo "🎉 All pre-deployment checks passed!"
```

### Blue-Green Deployment
```yaml
# scripts/blue-green-deployment.yml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: vball-app-green
spec:
  replicas: 3
  selector:
    matchLabels:
      app: vball-app
      version: green
  template:
    metadata:
      labels:
        app: vball-app
        version: green
    spec:
      containers:
      - name: vball-app
        image: vball-aggregator:v1.2.0
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: database-secret
              key: url
---
apiVersion: v1
kind: Service
metadata:
  name: vball-app-service
spec:
  selector:
    app: vball-app
    version: green  # Initially point to green (new version)
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer
```

### Deployment script
```bash
# scripts/deploy.sh
#!/bin/bash

set -e

VERSION=$1
DEPLOYMENT_TYPE=${2:-"blue-green"} # blue-green or rolling

if [ -z "$VERSION" ]; then
  echo "Usage: $0 <version> [deployment-type]"
  echo "Example: $0 v1.2.0 blue-green"
  exit 1
fi

echo "🚀 Starting deployment of version $VERSION"
echo "Deployment type: $DEPLOYMENT_TYPE"

# Validate environment
validate_environment() {
  echo "🔍 Validating environment..."
  
  required_vars=(
    "DATABASE_URL"
    "TELEGRAM_BOT_TOKEN"
    "REDIS_URL"
  )
  
  for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
      echo "❌ Environment variable $var is not set"
      exit 1
    fi
  done
  
  echo "✅ Environment validation passed"
}

# Create database backup
create_backup() {
  echo "💾 Creating database backup..."
  
  backup_name="backup_$(date +%Y%m%d_%H%M%S)_$VERSION"
  
  # Create backup
  pg_dump $DATABASE_URL > "backups/$backup_name.sql"
  
  # Compress backup
  gzip "backups/$backup_name.sql"
  
  echo "✅ Database backup created: backups/$backup_name.sql.gz"
}

# Deploy database migrations
deploy_migrations() {
  echo "🗃️ Deploying database migrations..."
  
  # Apply migrations
  npm run db:migrate:prod
  
  # Verify migration success
  migration_status=$(npm run db:migrate:status --silent | grep "0 migrations" || echo "fail")
  
  if [[ "$migration_status" == "fail" ]]; then
    echo "❌ Database migration failed"
    exit 1
  fi
  
  echo "✅ Database migrations applied successfully"
}

# Deploy application
deploy_application() {
  echo "🚀 Deploying application..."
  
  if [ "$DEPLOYMENT_TYPE" == "blue-green" ]; then
    deploy_blue_green
  elif [ "$DEPLOYMENT_TYPE" == "rolling" ]; then
    deploy_rolling
  else
    echo "❌ Unknown deployment type: $DEPLOYMENT_TYPE"
    exit 1
  fi
}

deploy_blue_green() {
  echo "🔄 Blue-Green deployment..."
  
  # Deploy to green environment
  kubectl apply -f k8s/green-deployment.yml
  
  # Wait for green deployment to be ready
  kubectl rollout status deployment/vball-app-green --timeout=600s
  
  # Run smoke tests
  run_smoke_tests
  
  # Switch traffic to green
  kubectl patch service vball-app-service -p '{"spec":{"selector":{"version":"green"}}}'
  
  echo "✅ Traffic switched to green deployment"
}

deploy_rolling() {
  echo "🔄 Rolling deployment..."
  
  # Update deployment image
  kubectl set image deployment/vball-app vball-app=vball-aggregator:$VERSION
  
  # Wait for rollout
  kubectl rollout status deployment/vball-app --timeout=600s
  
  # Run smoke tests
  run_smoke_tests
  
  echo "✅ Rolling deployment completed"
}

# Run smoke tests
run_smoke_tests() {
  echo "🧪 Running smoke tests..."
  
  # Run smoke test script
  if ./scripts/smoke-tests.sh; then
    echo "✅ Smoke tests passed"
  else
    echo "❌ Smoke tests failed"
    rollback_deployment
    exit 1
  fi
}

# Post-deployment verification
post_deployment_verification() {
  echo "🔍 Post-deployment verification..."
  
  # Check application health
  health_status=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_CHECK_URL)
  if [ "$health_status" != "200" ]; then
    echo "❌ Health check failed after deployment"
    rollback_deployment
    exit 1
  fi
  
  # Monitor key metrics for 5 minutes
  monitor_metrics 300
  
  echo "✅ Post-deployment verification passed"
}

# Monitor metrics
monitor_metrics() {
  local duration=$1
  local end_time=$((SECONDS + duration))
  
  echo "📊 Monitoring metrics for $duration seconds..."
  
  while [ $SECONDS -lt $end_time ]; do
    # Check error rate
    error_rate=$(curl -s $PROMETHEUS_URL/api/v1/query?query=rate(http_requests_total{status=~"5.."}[5m]) | jq -r '.data.result[0].value[1]')
    
    if (( $(echo "$error_rate > 0.1" | bc -l) )); then
      echo "⚠️ High error rate detected: $error_rate"
    fi
    
    # Check response time
    response_time=$(curl -s $PROMETHEUS_URL/api/v1/query?query=histogram_quantile(0.95,rate(http_request_duration_seconds_bucket[5m])) | jq -r '.data.result[0].value[1]')
    
    if (( $(echo "$response_time > 2.0" | bc -l) )); then
      echo "⚠️ High response time detected: ${response_time}s"
    fi
    
    sleep 30
  done
  
  echo "📊 Monitoring completed"
}

# Rollback function
rollback_deployment() {
  echo "⚠️ Initiating rollback..."
  
  if [ "$DEPLOYMENT_TYPE" == "blue-green" ]; then
    # Switch back to blue
    kubectl patch service vball-app-service -p '{"spec":{"selector":{"version":"blue"}}}'
    echo "✅ Rollback to blue deployment completed"
  else
    # Rollback rolling deployment
    kubectl rollout undo deployment/vball-app
    kubectl rollout status deployment/vball-app --timeout=300s
    echo "✅ Rolling deployment rollback completed"
  fi
}

# Cleanup
cleanup() {
  echo "🧹 Cleaning up..."
  
  # Remove old deployment if blue-green
  if [ "$DEPLOYMENT_TYPE" == "blue-green" ]; then
    kubectl delete deployment vball-app-blue || true
  fi
  
  echo "✅ Cleanup completed"
}

# Main deployment flow
main() {
  validate_environment
  create_backup
  deploy_migrations
  deploy_application
  post_deployment_verification
  cleanup
  
  echo "🎉 Deployment of version $VERSION completed successfully!"
}

# Run main function
main
```

### Health check endpoints
```typescript
// src/health/health-check.controller.ts
import { Controller, Get } from '@nestjs/common'
import { HealthChecker } from './health-checker.service'

@Controller('health')
export class HealthCheckController {
  constructor(private healthChecker: HealthChecker) {}

  @Get()
  async health() {
    const health = await this.healthChecker.checkAll()
    
    return {
      status: health.overall === 'healthy' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      checks: health.checks,
      version: process.env.APP_VERSION
    }
  }

  @Get('ready')
  async readiness() {
    const ready = await this.healthChecker.checkReadiness()
    
    return {
      status: ready ? 'ok' : 'error',
      timestamp: new Date().toISOString()
    }
  }

  @Get('live')
  async liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString()
    }
  }
}
```

## Post-release действия

### Release announcement
```markdown
# 🎉 Release Announcement: v1.2.0 "Volleyball Master"

We're excited to announce the release of VBallAgregator v1.2.0!

## What's New

✨ **User Registration System**
- Easy registration through Telegram bot
- Player level categorization
- Profile management

💳 **Payment Integration** 
- Online card payments
- Payment history tracking
- Automated receipts

🎮 **Enhanced Game Management**
- Better game filtering
- Automated waitlists
- Organizer dashboard

## Upgrade Instructions

### For Users
No action required! The update will be automatically applied.

### For Self-hosted Deployments
1. Update Docker images: `docker-compose pull`
2. Run migrations: `npm run db:migrate`
3. Restart services: `docker-compose up -d`

## Known Issues
- Push notifications may have 1-2 minute delay during peak hours
- Large game images (>5MB) upload slowly (workaround: compress images)

## Thank You!
Thanks to all users and contributors who made this release possible!

**Full changelog**: https://github.com/vball-aggregator/releases/tag/v1.2.0
```

### Monitoring setup
```typescript
// src/monitoring/post-release-monitor.ts
export class PostReleaseMonitor {
  private metrics = {
    apiResponseTime: [],
    errorRate: [],
    userRegistrations: [],
    gameCreations: [],
    paymentCompletions: []
  }

  async startMonitoring() {
    console.log('📊 Starting post-release monitoring...')
    
    // Monitor for 2 hours
    const monitoringDuration = 2 * 60 * 60 * 1000 // 2 hours
    const checkInterval = 5 * 60 * 1000 // 5 minutes
    
    const endTime = Date.now() + monitoringDuration
    
    const interval = setInterval(async () => {
      await this.collectMetrics()
      
      if (Date.now() > endTime) {
        clearInterval(interval)
        await this.generateReport()
      }
    }, checkInterval)
  }

  private async collectMetrics() {
    try {
      // API Response Time
      const responseTime = await this.getAverageResponseTime()
      this.metrics.apiResponseTime.push({
        timestamp: Date.now(),
        value: responseTime
      })

      // Error Rate
      const errorRate = await this.getErrorRate()
      this.metrics.errorRate.push({
        timestamp: Date.now(),
        value: errorRate
      })

      // User Activity
      const registrations = await this.getUserRegistrations()
      this.metrics.userRegistrations.push({
        timestamp: Date.now(),
        value: registrations
      })

      console.log(`📊 Metrics collected at ${new Date().toISOString()}`)
    } catch (error) {
      console.error('❌ Failed to collect metrics:', error)
    }
  }

  private async generateReport() {
    console.log('📋 Generating post-release report...')
    
    const report = {
      duration: '2 hours',
      metrics: {
        avgResponseTime: this.calculateAverage(this.metrics.apiResponseTime),
        maxErrorRate: Math.max(...this.metrics.errorRate.map(m => m.value)),
        totalRegistrations: this.sumMetrics(this.metrics.userRegistrations)
      },
      alerts: await this.checkForAlerts(),
      timestamp: new Date().toISOString()
    }
    
    // Send report to team
    await this.sendReportToTeam(report)
    
    console.log('📊 Post-release monitoring completed')
  }

  private async checkForAlerts(): Promise<string[]> {
    const alerts = []
    
    // Check error rate
    const maxErrorRate = Math.max(...this.metrics.errorRate.map(m => m.value))
    if (maxErrorRate > 0.05) { // 5%
      alerts.push(`High error rate detected: ${(maxErrorRate * 100).toFixed(2)}%`)
    }
    
    // Check response time
    const avgResponseTime = this.calculateAverage(this.metrics.apiResponseTime)
    if (avgResponseTime > 2000) { // 2 seconds
      alerts.push(`High response time detected: ${avgResponseTime}ms`)
    }
    
    return alerts
  }
}
```

## Rollback процедуры

### Emergency rollback script
```bash
# scripts/emergency-rollback.sh
#!/bin/bash

set -e

PREVIOUS_VERSION=$1
CURRENT_VERSION=$2

if [ -z "$PREVIOUS_VERSION" ] || [ -z "$CURRENT_VERSION" ]; then
  echo "Usage: $0 <previous-version> <current-version>"
  echo "Example: $0 v1.1.2 v1.2.0"
  exit 1
fi

echo "⚠️ EMERGENCY ROLLBACK INITIATED"
echo "Rolling back from $CURRENT_VERSION to $PREVIOUS_VERSION"
echo "Reason: $3"

# Notify team immediately
notify_team "EMERGENCY ROLLBACK initiated from $CURRENT_VERSION to $PREVIOUS_VERSION"

# Immediate traffic switch to previous version
echo "🚦 Switching traffic to previous version..."
kubectl patch service vball-app-service -p "{\"spec\":{\"selector\":{\"version\":\"blue\"}}}"

# Database rollback if needed
echo "🗃️ Rolling back database changes..."
if [ -f "backups/backup_$(date +%Y%m%d)_${CURRENT_VERSION}.sql.gz" ]; then
  echo "Rolling back to backup..."
  gunzip -c "backups/backup_$(date +%Y%m%d)_${CURRENT_VERSION}.sql.gz" | psql $DATABASE_URL
else
  echo "❌ Backup file not found. Manual database rollback required."
fi

# Redeploy previous version
echo "🔄 Redeploying previous version..."
kubectl set image deployment/vball-app vball-app=vball-aggregator:$PREVIOUS_VERSION
kubectl rollout status deployment/vball-app --timeout=300s

# Verify rollback
echo "✅ Verifying rollback..."
sleep 30

health_status=$(curl -s -o /dev/null -w "%{http_code}" $HEALTH_CHECK_URL)
if [ "$health_status" != "200" ]; then
  echo "❌ Rollback verification failed!"
  exit 1
fi

echo "🎉 Rollback completed successfully"

# Generate incident report
generate_incident_report "$CURRENT_VERSION" "$PREVIOUS_VERSION" "$3"
```

### Database rollback
```sql
-- migrations/rollback_v1.2.0.sql

-- Only run if data migration is safe to rollback
-- Always backup before running!

-- Remove new columns added in v1.2.0
ALTER TABLE games DROP COLUMN IF EXISTS auto_cancellation;
ALTER TABLE games DROP COLUMN IF EXISTS waitlist_enabled;

-- Remove new tables if safe
DROP TABLE IF EXISTS payment_transactions CASCADE;
DROP TABLE IF EXISTS user_preferences CASCADE;

-- Revert index changes
DROP INDEX IF EXISTS idx_games_status_date;
CREATE INDEX idx_games_status ON games (status, date_time);

-- Update version
UPDATE schema_migrations SET version = '1.1.2' WHERE version = '1.2.0';
```

## Мониторинг и алертинг

### Alert configuration
```yaml
# prometheus/alerts.yml
groups:
- name: vball-aggregator
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 2m
    labels:
      severity: critical
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} errors per second"

  - alert: HighResponseTime
    expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "High response time detected"
      description: "95th percentile response time is {{ $value }}s"

  - alert: DatabaseConnectionDown
    expr: up{job="postgres"} == 0
    for: 1m
    labels:
      severity: critical
    annotations:
      summary: "Database connection is down"
      description: "PostgreSQL database is unreachable"

  - alert: LowDiskSpace
    expr: (node_filesystem_size_bytes - node_filesystem_free_bytes) / node_filesystem_size_bytes > 0.9
    for: 5m
    labels:
      severity: warning
    annotations:
      summary: "Disk space is running low"
      description: "Disk usage is {{ $value | humanizePercentage }}"
```

### Monitoring dashboard
```typescript
// Grafana dashboard configuration
{
  "dashboard": {
    "title": "VBall Aggregator - Release Monitoring",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])",
            "legendFormat": "{{method}} {{status}}"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph", 
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "singlestat",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m]) / rate(http_requests_total[5m]) * 100",
            "legendFormat": "Error %"
          }
        ]
      }
    ]
  }
}
```

## Документация релиза

### Release checklist
```markdown
# Release Checklist v1.2.0

## Pre-release
- [ ] Code freeze implemented
- [ ] All tests passing
- [ ] Code review completed
- [ ] Documentation updated
- [ ] Migration scripts tested
- [ ] Release notes drafted

## Testing
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Performance tests completed
- [ ] Security scan completed
- [ ] Smoke tests on staging passed

## Deployment
- [ ] Production environment prepared
- [ ] Blue/Green deployment configured
- [ ] Monitoring alerts set up
- [ ] Rollback procedure documented
- [ ] Database backup created
- [ ] Team notification sent

## Post-release
- [ ] Health checks passing
- [ ] Metrics monitoring active
- [ ] Release announcement sent
- [ ] GitHub release created
- [ ] Blog post published
- [ ] Social media announcement
- [ ] Incident response ready

## Success Criteria
- [ ] Error rate < 1%
- [ ] Response time < 2 seconds
- [ ] No data loss
- [ ] No security vulnerabilities
- [ ] All critical functionality working
- [ ] User complaints < 5
```

---

**Последнее обновление**: 2025-11-24  
**Версия**: 1.0.0