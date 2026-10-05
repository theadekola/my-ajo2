import { Component } from 'react';
import SvgIcon from './SvgIcon.jsx';
import { Link } from 'react-router-dom';

export default class PageErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Page failed to render', error, info);
  }

  componentDidUpdate(prevProps) {
    if (prevProps.locationKey !== this.props.locationKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="page-enter" style={{ minHeight: '60vh', display: 'grid', placeItems: 'center' }}>
        <div className="card" style={{ maxWidth: 560, width: '100%', padding: 26, textAlign: 'center' }}>
          <div style={{ marginBottom: 10, color: 'var(--red)' }}><SvgIcon name="warning" size={42} /></div>
          <div style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 24, fontWeight: 800, color: 'var(--deep)', marginBottom: 8 }}>This page needs a refresh</div>
          <div style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7, marginBottom: 18 }}>
            The app caught a page error instead of showing a blank screen. Please refresh this page or go back to your dashboard.
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-g" type="button" onClick={() => window.location.reload()}>Refresh Page</button>
            <Link className="btn btn-gh" to="/dashboard">Go to Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }
}
