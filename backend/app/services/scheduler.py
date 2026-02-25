"""
Reminder scheduler — checks active reminders every minute and emits
Socket.IO events to connected elder clients so reminders fire even when
the elder tab is open without manual polling.
"""
from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime


_scheduler = None


def start_scheduler(app):
    global _scheduler
    if _scheduler and _scheduler.running:
        return

    _scheduler = BackgroundScheduler(daemon=True)

    @_scheduler.scheduled_job("interval", minutes=1)
    def check_reminders():
        with app.app_context():
            from app.extensions import db, socketio
            from app.models import Reminder

            now_time = datetime.utcnow().strftime("%H:%M")
            due = db.session.query(Reminder).filter_by(
                scheduled_time=now_time, active=True
            ).all()

            for r in due:
                socketio.emit("reminder_due", {
                    "elder_id":    r.elder_id,
                    "reminder_id": r.id,
                    "title":       r.title,
                    "body":        r.body,
                })

    _scheduler.start()
