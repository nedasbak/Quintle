import { useEffect, useState } from 'react';
import Dialog from '../../components/Dialog.jsx';
import { getThemes } from './api.js';

export default function PracticePicker({ pending, error, onStart, onClose }) {
  const [catalog, setCatalog] = useState({ themes: null, error: '' });
  const [retry, setRetry] = useState(0);
  const [themeId, setThemeId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setCatalog({ themes: null, error: '' });
    getThemes(controller.signal).then(themes => {
      if (!controller.signal.aborted) setCatalog({ themes, error: '' });
    }).catch(failure => {
      if (!controller.signal.aborted) setCatalog({ themes: null, error: failure.message });
    });
    return () => controller.abort();
  }, [retry]);
  const theme = catalog.themes?.find(item => item.id === themeId) ?? catalog.themes?.[0];
  const choice = theme?.challenges.find(item => item.id === challengeId) ?? theme?.challenges[0];
  return (
    <Dialog open title="Choose practice" onClose={onClose}>
      <p className="dialog-intro">Unlimited rounds. Your daily result and streak stay unchanged. Start begins the 30-second timer.</p>
      {!catalog.themes && <p role="status">{catalog.error || 'Loading themes…'}</p>}
      {catalog.error && <button className="text-button" onClick={() => setRetry(value => value + 1)}>Retry themes</button>}
      {catalog.themes && <form className="practice-picker" onSubmit={event => { event.preventDefault(); if (choice && !pending) onStart(choice.id); }}>
        <label>Theme<select value={theme?.id ?? ''} disabled={pending} onChange={event => { setThemeId(event.target.value); setChallengeId(''); }}>
          {catalog.themes.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select></label>
        <fieldset disabled={pending}><legend>Choose a challenge</legend>
          {theme?.challenges.map(item => <label key={item.id}><input type="radio" name="practice-challenge" value={item.id}
            checked={choice?.id === item.id} onChange={() => setChallengeId(item.id)} />{item.prompt}</label>)}
        </fieldset>
        {!choice && <p role="status">No practice challenges available.</p>}
        {error && <p role="alert">{error}</p>}
        <button className="primary-button" disabled={pending || !choice}>{pending ? 'Starting…' : 'Start practice'}</button>
      </form>}
    </Dialog>
  );
}
