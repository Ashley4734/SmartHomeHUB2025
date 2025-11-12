# Privacy Policy

**Last Updated:** November 12, 2025
**Version:** 1.0

## 1. Introduction

This Privacy Policy describes how SmartHomeHUB ("we", "us", or "our") collects, uses, and protects your personal information when you use our smart home management system.

We are committed to protecting your privacy and ensuring transparency about our data practices. This policy is designed to comply with the General Data Protection Regulation (GDPR) and other applicable privacy laws.

## 2. Data Controller

**SmartHomeHUB**
[Your Organization Name]
[Your Address]
[Contact Email]
[Contact Phone]

For privacy-related inquiries, please contact: privacy@smarthomehub.local

## 3. Data We Collect

### 3.1 Account Information
- Username and email address
- Password (stored as encrypted hash)
- Full name (optional)
- Account role and permissions
- Account creation and last login timestamps

### 3.2 Device Data
- Device names, types, and protocols
- Device states and capabilities
- Device control commands and parameters
- Device online/offline status
- Device history and state changes

### 3.3 Automation Data
- Automation rules and configurations
- Trigger conditions and actions
- Automation execution logs
- Scenes and room configurations

### 3.4 AI and Voice Data
- AI chat conversations and context
- Voice commands (text transcripts)
- AI-generated suggestions and recommendations
- User behavior patterns learned by AI
- Intent recognition data

### 3.5 Security and Audit Data
- Login attempts (successful and failed)
- IP addresses and user agents
- Authentication audit logs
- Brute force protection records
- Security events and alerts

### 3.6 Usage Data
- Notifications and alerts
- System settings and preferences
- API usage and interaction patterns
- Error logs and diagnostics

## 4. How We Use Your Data

### 4.1 Essential Services (Legal Basis: Contract)
- **Account Management**: Creating and maintaining your user account
- **Device Control**: Executing device commands and managing smart home devices
- **Security**: Authenticating users and protecting against unauthorized access
- **Service Delivery**: Operating core smart home automation features

### 4.2 Personalization (Legal Basis: Consent)
- **AI Learning**: Analyzing usage patterns to provide personalized suggestions
- **Automation Optimization**: Improving automation rules based on your behavior
- **User Experience**: Customizing interface and recommendations

### 4.3 Analytics (Legal Basis: Legitimate Interest)
- **System Monitoring**: Tracking system performance and errors
- **Usage Statistics**: Understanding feature usage to improve the service
- **Security Analysis**: Detecting and preventing security threats

### 4.4 Communication (Legal Basis: Consent)
- **Service Notifications**: Sending alerts about device status and automations
- **Security Alerts**: Notifying you of important security events
- **Updates**: Informing you about new features and improvements

## 5. Legal Basis for Processing

Under GDPR, we process your data based on:

1. **Contract**: Processing necessary to provide the service you signed up for
2. **Consent**: Where you have given explicit consent (e.g., AI personalization, analytics)
3. **Legitimate Interest**: For security, fraud prevention, and service improvement
4. **Legal Obligation**: To comply with legal requirements (e.g., security breach notifications)

## 6. Data Retention

| Data Type | Retention Period | Reason |
|-----------|-----------------|---------|
| Account Information | Until account deletion | Service provision |
| Device Data | Until device removal or account deletion | Service provision |
| Automation Logs | 90 days | Debugging and analytics |
| Device History | 180 days | Historical analysis |
| Voice Commands | 90 days | Service improvement |
| AI Conversations | Until account deletion | Personalization |
| Security Audit Logs | 1 year | Security and compliance |
| Failed Login Attempts | 24 hours | Brute force protection |

After the retention period, data is automatically deleted from our systems.

## 7. Your Rights Under GDPR

You have the following rights regarding your personal data:

### 7.1 Right to Access
You can request a copy of all personal data we hold about you.
- **API Endpoint**: `GET /api/gdpr/export`
- **Web Interface**: Account Settings → Privacy → Export My Data

### 7.2 Right to Rectification
You can update incorrect or incomplete personal data.
- **API Endpoint**: `PATCH /api/users/:id`
- **Web Interface**: Account Settings → Profile

### 7.3 Right to Erasure (Right to be Forgotten)
You can request deletion of all your personal data.
- **API Endpoint**: `DELETE /api/gdpr/delete`
- **Web Interface**: Account Settings → Privacy → Delete My Account
- **Note**: This action is irreversible and requires password confirmation

### 7.4 Right to Data Portability
You can receive your data in a structured, machine-readable format (JSON).
- **API Endpoint**: `GET /api/gdpr/export`

### 7.5 Right to Restrict Processing
You can request limitation of data processing.
- Contact us at privacy@smarthomehub.local

### 7.6 Right to Object
You can object to processing based on legitimate interests.
- Withdraw consent in Account Settings → Privacy → Manage Consents

### 7.7 Right to Withdraw Consent
You can withdraw consent for analytics and personalization at any time.
- **API Endpoint**: `POST /api/gdpr/consents`
- **Web Interface**: Account Settings → Privacy → Manage Consents

### 7.8 Right to Lodge a Complaint
You can file a complaint with your local data protection authority.

## 8. Consent Management

We use a granular consent system for optional data processing:

### Essential Consent (Required)
- Account creation and authentication
- Device control and management
- Core automation features
- Security measures

**Note**: Essential consent cannot be withdrawn. If you wish to stop using essential services, please delete your account.

### Optional Consents

#### Analytics Consent
- Usage pattern analysis
- Feature usage statistics
- System performance monitoring

#### Personalization Consent
- AI learning from your behavior
- Personalized suggestions
- Automation optimization

#### Marketing Consent
- Product updates and newsletters
- New feature announcements
- Tips and best practices

You can manage your consents at any time in Account Settings → Privacy → Manage Consents.

## 9. Data Security

We implement industry-standard security measures to protect your data:

### Technical Measures
- **Encryption**: All passwords are hashed using bcrypt (10 rounds)
- **HTTPS/TLS**: All data in transit is encrypted using TLS 1.2+
- **HSTS**: HTTP Strict Transport Security enforced
- **Content Security Policy**: CSP headers prevent XSS attacks
- **CSRF Protection**: Double-submit cookie pattern protects against CSRF
- **Rate Limiting**: Per-user rate limits prevent abuse
- **Brute Force Protection**: Account lockout after failed login attempts

### Organizational Measures
- Access control with role-based permissions (Admin, User, Guest)
- Security audit logging for all authentication events
- Regular security updates and patches
- Incident response procedures

### Database Security
- SQLite database with file-system level access control
- Foreign key constraints enforce referential integrity
- Prepared statements prevent SQL injection
- Regular automated backups

## 10. Third-Party Services

### 10.1 AI Providers
If you use AI features, we may send your data to third-party AI providers:
- OpenAI (ChatGPT)
- Anthropic (Claude)
- Google (Gemini)

**Data Shared**: Chat messages, automation descriptions, device information
**Purpose**: AI-powered suggestions and natural language processing
**Legal Basis**: Consent (can be withdrawn in settings)

### 10.2 Voice Recognition
If you use voice control, audio data may be processed by:
- Speech recognition services (provider-dependent)

**Data Shared**: Voice recordings or audio transcripts
**Purpose**: Voice command recognition
**Legal Basis**: Consent (can be withdrawn in settings)

### 10.3 Monitoring Services
For system health monitoring:
- Prometheus (self-hosted, no data leaves your infrastructure)
- Grafana (self-hosted, no data leaves your infrastructure)

### 10.4 No Third-Party Data Sharing
We do **NOT**:
- Sell your personal data to third parties
- Share your data with advertisers
- Use your data for marketing purposes without consent
- Share data with law enforcement without a valid legal request

## 11. Data Processing Log

We maintain a comprehensive log of all data processing activities:
- Processing type and purpose
- Data categories processed
- Legal basis for processing
- Timestamp and recipient (if applicable)

You can view your data processing history:
- **API Endpoint**: `GET /api/gdpr/processing-history`
- **Web Interface**: Account Settings → Privacy → Processing History

## 12. International Data Transfers

SmartHomeHUB is designed to be self-hosted on your own infrastructure. By default:
- All data remains on your local server
- No international data transfers occur
- You control data location

If you use third-party AI services, data may be transferred to:
- United States (OpenAI, Anthropic)
- European Union (if using EU-based providers)

These transfers are based on:
- Standard Contractual Clauses (SCCs)
- Adequacy decisions
- Your explicit consent

## 13. Children's Privacy

SmartHomeHUB is not intended for use by individuals under the age of 16. We do not knowingly collect personal data from children. If you believe we have collected data from a child, please contact us immediately.

## 14. Cookies and Local Storage

We use minimal cookies for essential functionality:

### Essential Cookies
- **Session Token**: Maintains your authenticated session (JWT)
- **CSRF Token**: Protects against cross-site request forgery
- **Lifetime**: Session cookies (cleared when browser closes)

### Optional Cookies
- **Preferences**: Stores UI preferences and settings
- **Analytics**: Tracks usage patterns (requires consent)

You can manage cookie preferences in your browser settings.

## 15. Automated Decision-Making

We use automated decision-making in the following scenarios:

### AI-Generated Automations
- **Purpose**: Suggest automation rules based on usage patterns
- **Impact**: Recommendations only; user must approve
- **Right to Object**: You can disable AI suggestions in settings

### Brute Force Protection
- **Purpose**: Lock accounts after repeated failed login attempts
- **Impact**: Temporary account lockout (automatic unlock after 30 minutes)
- **Right to Object**: Contact support for manual unlock

You have the right to object to automated decision-making and request human intervention.

## 16. Data Breach Notification

In the event of a data breach:
1. We will assess the risk to your rights and freedoms
2. If there is a high risk, we will notify you within 72 hours
3. We will notify the relevant supervisory authority
4. We will provide information on:
   - Nature of the breach
   - Likely consequences
   - Measures taken to mitigate harm
   - Contact information for further inquiries

## 17. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. When we make changes:
1. We will update the "Last Updated" date
2. We will increment the version number
3. We will notify you via:
   - Email (for significant changes)
   - In-app notification
   - Change log in the documentation

Continued use of SmartHomeHUB after changes constitutes acceptance of the updated policy.

## 18. Contact Information

For privacy-related questions, requests, or concerns:

**Email**: privacy@smarthomehub.local
**Web**: Account Settings → Privacy → Contact Privacy Team
**API**: Support endpoints available at `/api/support`

### Data Protection Officer (if applicable)
**Name**: [DPO Name]
**Email**: dpo@smarthomehub.local

### Supervisory Authority
If you are located in the EU/EEA, you have the right to lodge a complaint with your local supervisory authority:
- [Link to EU supervisory authorities list](https://edpb.europa.eu/about-edpb/board/members_en)

## 19. Open Source and Transparency

SmartHomeHUB is open source software. You can review our code, security measures, and data handling practices at:
- **GitHub**: [Repository URL]
- **Documentation**: [Documentation URL]
- **Security Policy**: See SECURITY.md

## 20. Consent Record

When you create an account, we record:
- Consent type and version
- Date and time of consent
- IP address and user agent
- Whether consent was given or withdrawn

This creates a verifiable audit trail of your consent choices.

---

## Summary of Your Rights

| Right | How to Exercise | Response Time |
|-------|----------------|---------------|
| Access | GET /api/gdpr/export | Immediate |
| Rectification | PATCH /api/users/:id | Immediate |
| Erasure | DELETE /api/gdpr/delete | Immediate |
| Portability | GET /api/gdpr/export (JSON) | Immediate |
| Restrict Processing | Contact privacy team | 30 days |
| Object | Withdraw consent in settings | Immediate |
| Withdraw Consent | POST /api/gdpr/consents | Immediate |
| Lodge Complaint | Contact supervisory authority | N/A |

---

**This Privacy Policy was last updated on November 12, 2025 and is effective immediately.**

For the most up-to-date version of this policy, please visit our documentation or check your Account Settings.
