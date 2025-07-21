# WhatsApp Notifications Integration

## Overview

This feature adds automatic WhatsApp notifications to the WaitLess CHU queue management system. Patients receive WhatsApp messages when it's their turn in the queue, telling them to head to the secretary immediately.

## Features

- ✅ **Automatic Notifications**: Sends WhatsApp messages when a patient reaches position 1
- ✅ **Phone Number Formatting**: Converts various phone formats to +212 (Morocco) format
- ✅ **Error Handling**: Graceful failure - notifications never crash the main system
- ✅ **Test Mode**: Safe testing without sending actual messages
- ✅ **Configurable**: Enable/disable and customize via configuration
- ✅ **Lightweight**: Simple integration with minimal dependencies

## Phone Number Formats Supported

The system automatically converts these formats to `+212XXXXXXXXX`:

| Input Format | Output |
|-------------|--------|
| `0693955230` | `+212693955230` |
| `693955230` | `+212693955230` |
| `+212693955230` | `+212693955230` |
| `06-93-95-52-30` | `+212693955230` |
| `06 93 95 52 30` | `+212693955230` |

## Message Format

When it's a patient's turn (position 1), they receive:

```
🏥 Bonjour Ahmed Benali!

📢 C'est votre tour au service Cardiologie.
⏰ Veuillez vous présenter immédiatement au secrétariat.

✅ Merci d'utiliser WaitLess CHU - Votre temps est précieux!
```

## Configuration

Add these settings to `Backend/config.py`:

```python
# WhatsApp Notifications
whatsapp_enabled: bool = True          # Enable/disable notifications
whatsapp_test_mode: bool = False       # Test mode (logs only, no sending)
whatsapp_wait_time: int = 15           # Seconds to wait before sending
whatsapp_country_code: str = "+212"    # Morocco country code
```

## Installation

1. **Install pywhatkit** (already added to requirements.txt):
```bash
pip install pywhatkit==5.4
```

2. **No additional setup required** - the integration is automatic.

## How It Works

### When Notifications Are Triggered

1. **Patient Called**: When admin calls the next patient
2. **Queue Updates**: When queue positions are recalculated
3. **Position 1**: Only when a patient reaches position 1

### Integration Points

The WhatsApp notifications are integrated into:

- `Backend/routers/queue.py` - Main queue management
- `Backend/routers/tickets.py` - Queue position updates
- `Backend/whatsapp_service.py` - Core WhatsApp functionality

### Error Handling

- ❌ **Invalid phone numbers** → Logged warning, no crash
- ❌ **pywhatkit failure** → Logged error, no crash
- ❌ **Network issues** → Logged error, no crash
- ✅ **Queue operations continue normally** regardless of notification status

## Testing

### Test Mode (Safe)

Enable test mode to see what would be sent without actually sending:

```python
# In Backend/config.py
whatsapp_test_mode: bool = True
```

### Run Test Script

```bash
cd Backend
python test_whatsapp_integration.py
```

This will:
- Test phone number formatting
- Test message creation
- Test integration with database
- Show usage instructions

### Manual Testing with Real Messages

1. Set `whatsapp_test_mode = False` in config.py
2. Ensure WhatsApp Web is logged in on the server computer
3. Test with a real queue scenario

## File Structure

```
Backend/
├── whatsapp_service.py              # Core WhatsApp functionality
├── test_whatsapp_integration.py     # Test script
├── config.py                        # Configuration (updated)
├── main.py                          # Initialization (updated)
├── requirements.txt                 # Dependencies (updated)
└── routers/
    ├── queue.py                     # Queue management (updated)
    └── tickets.py                   # Ticket management (updated)
```

## Usage Examples

### Scenario 1: Normal Queue Flow

1. Patient A joins queue → Position 1
2. Patient B joins queue → Position 2
3. Admin calls Patient A → Patient B moves to Position 1
4. **WhatsApp sent to Patient B**: "C'est votre tour!"

### Scenario 2: Multiple Patients

1. Patients A, B, C in queue → Positions 1, 2, 3
2. Admin calls Patient A → B→1, C→2
3. **WhatsApp sent to Patient B** (now position 1)
4. Admin calls Patient B → C→1
5. **WhatsApp sent to Patient C** (now position 1)

## pywhatkit Usage

The system uses `pywhatkit.sendwhatmsg_instantly()` with these parameters:

```python
pywhatkit.sendwhatmsg_instantly(
    phone_no="+212693955230",
    message="🏥 Bonjour Ahmed! C'est votre tour...",
    wait_time=15,
    tab_close=True
)
```

## Requirements for WhatsApp Web

- **Computer/Server**: Must have a web browser
- **WhatsApp Web**: Must be logged in to WhatsApp Web
- **Network**: Stable internet connection
- **Browser**: Chrome or compatible browser

## Troubleshooting

### Common Issues

1. **"pywhatkit not found"**
   - Solution: `pip install pywhatkit==5.4`

2. **"WhatsApp Web not logged in"**
   - Solution: Open WhatsApp Web and scan QR code

3. **Phone number format errors**
   - Check logs for formatting warnings
   - Ensure phone numbers are stored correctly in database

4. **Messages not sending**
   - Check if test_mode is enabled
   - Verify WhatsApp Web login
   - Check server browser permissions

### Debug Mode

Enable detailed logging:

```python
import logging
logging.basicConfig(level=logging.INFO)
```

### Test Commands

```bash
# Test WhatsApp service directly
cd Backend
python -c "
import asyncio
from whatsapp_service import test_whatsapp_service
asyncio.run(test_whatsapp_service('0693955230', 'Test Patient'))
"
```

## Security Notes

- ✅ **No credentials stored**: Uses WhatsApp Web session
- ✅ **Error isolation**: Failures don't affect main system
- ✅ **Test mode**: Safe testing without real messages
- ✅ **Configurable**: Can be completely disabled

## Performance Impact

- **Minimal**: Async execution doesn't block queue operations
- **Lightweight**: Only imports pywhatkit when needed
- **Efficient**: Single message per position change to position 1
- **Resilient**: Graceful failure handling

## Future Enhancements

Possible future improvements:
- 📧 Email notifications backup
- 📱 SMS integration
- 🌍 Multi-language support
- 📊 Notification delivery tracking
- ⚙️ Admin notification controls
- 🔄 Retry mechanism for failed sends

## Support

For issues or questions:
1. Check logs in console/server logs
2. Run test script: `python test_whatsapp_integration.py`
3. Verify configuration in `Backend/config.py`
4. Ensure WhatsApp Web is properly logged in

---

**Note**: This is a PFE (school project) implementation designed for local Windows development. For production use, consider additional security and reliability measures.