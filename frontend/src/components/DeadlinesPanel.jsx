import { useEffect, useMemo, useState } from "react";

const ALERT_STORAGE_KEY = "sarveshu-deadline-alerts";
const ALERT_LAST_SENT_KEY = "sarveshu-deadline-alerts-last-sent";

const EVENT_TYPE_OPTIONS = [
  { value: "all", label: "all" },
  { value: "conference", label: "conference" },
  { value: "workshop", label: "workshop" },
];

function formatDays(daysRemaining) {
  if (daysRemaining === 0) return "today";
  if (daysRemaining === 1) return "1 day";
  if (daysRemaining > 1) return `${daysRemaining} days`;
  if (daysRemaining === -1) return "closed yesterday";
  return `closed ${Math.abs(daysRemaining)} days ago`;
}

function formatDate(isoDate) {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DeadlinesPanel({
  deadlines,
  loading,
  error,
  updatedAt,
  eventType = "all",
  openTotal = 0,
  fallbackMode = "none",
  onEventTypeChange,
  onRefresh,
}) {
  const [alertsEnabled, setAlertsEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(ALERT_STORAGE_KEY) === "true";
  });

  const nearestOpenDeadline = useMemo(() => {
    return (deadlines || []).find((item) => item.isOpen) || null;
  }, [deadlines]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ALERT_STORAGE_KEY, alertsEnabled ? "true" : "false");
  }, [alertsEnabled]);

  useEffect(() => {
    if (!alertsEnabled || !nearestOpenDeadline) return;
    if (typeof window === "undefined" || typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;
    if (nearestOpenDeadline.daysRemaining > 14) return;

    const todayKey = new Date().toISOString().slice(0, 10);
    const lastSent = localStorage.getItem(ALERT_LAST_SENT_KEY);
    if (lastSent === todayKey) return;

    const description = `${nearestOpenDeadline.shortTitle || nearestOpenDeadline.title} closes in ${formatDays(
      nearestOpenDeadline.daysRemaining
    )}`;
    new Notification("Sarveshu deadline alert", { body: description });
    localStorage.setItem(ALERT_LAST_SENT_KEY, todayKey);
  }, [alertsEnabled, nearestOpenDeadline]);

  const handleAlertsToggle = async () => {
    if (typeof window === "undefined" || typeof Notification === "undefined") {
      setAlertsEnabled(false);
      return;
    }

    if (alertsEnabled) {
      setAlertsEnabled(false);
      return;
    }

    if (Notification.permission === "granted") {
      setAlertsEnabled(true);
      return;
    }

    const permission = await Notification.requestPermission();
    setAlertsEnabled(permission === "granted");
  };

  return (
    <section className="panel panel--deadlines">
      <header className="panel__header panel__header--inline">
        <div>
          <h2 className="panel__title">active deadlines</h2>
          <p className="panel__caption">
            {fallbackMode === "closed_only"
              ? "no open verified deadlines right now; showing latest verified closed deadlines"
              : "verified official deadlines only"}
          </p>
        </div>
        <button type="button" className="panel__button" onClick={onRefresh}>
          refresh
        </button>
      </header>

      <div className="deadline-filters" role="group" aria-label="deadline type filter">
        {EVENT_TYPE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={
              option.value === eventType
                ? "deadline-filters__button deadline-filters__button--active"
                : "deadline-filters__button"
            }
            onClick={() => onEventTypeChange?.(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {updatedAt ? (
        <p className="panel__muted panel__muted--tiny">
          updated {new Date(updatedAt).toLocaleString()} · open now {openTotal}
        </p>
      ) : null}

      <button type="button" className="panel__button panel__button--full" onClick={handleAlertsToggle}>
        {alertsEnabled ? "alerts on" : "enable alerts"}
      </button>

      {loading ? <p className="panel__muted">loading deadlines...</p> : null}
      {error ? <p className="panel__error">{error}</p> : null}

      {!loading && !error && deadlines.length === 0 ? (
        <p className="panel__muted">no verified deadlines found from official sources.</p>
      ) : null}

      <div className="deadline-list">
        {deadlines.map((deadline) => (
          <article key={deadline.id} className="deadline-card">
            <div className="deadline-card__top">
              <p className="deadline-card__title">{deadline.shortTitle || deadline.title}</p>
              <span
                className={
                  deadline.isOpen
                    ? "deadline-card__status deadline-card__status--open"
                    : "deadline-card__status"
                }
              >
                {deadline.isOpen ? "open" : "closed"}
              </span>
            </div>

            <p className="deadline-card__meta">
              <span>{deadline.eventType}</span>
              {deadline.deadlineType ? (
                <>
                  <span className="deadline-card__meta-sep" aria-hidden="true">
                    ·
                  </span>
                  <span>{deadline.deadlineType}</span>
                </>
              ) : null}
              <span className="deadline-card__meta-sep" aria-hidden="true">
                ·
              </span>
              <span>{formatDays(deadline.daysRemaining)}</span>
              <span className="deadline-card__meta-sep" aria-hidden="true">
                ·
              </span>
              <span>due {formatDate(deadline.deadline)}</span>
            </p>

            <div className="deadline-card__actions">
              {deadline.link ? (
                <a href={deadline.link} target="_blank" rel="noopener noreferrer">
                  details
                </a>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
