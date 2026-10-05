import { Link } from 'react-router-dom';

const heroStats = [
  ['10,000+', 'Savers across Africa'],
  ['4.9/5', 'Community rating'],
  ['150+', 'Countries supported'],
];

const steps = [
  ['1', 'Create or Join a Group', 'Form a savings group with family, friends, colleagues, or members of your community.'],
  ['2', 'Contribute Regularly', 'Pay weekly or monthly, upload proof, and track every contribution in one place.'],
  ['3', 'Receive Your Payout', 'When it is your turn, receive the full pot and keep the cycle moving for everyone.'],
  ['4', 'Stay Protected', 'Admins get clear tools, members get transparency, and every transaction stays accountable.'],
];

const features = [
  ['Multi-Currency', 'Support for ₦, $, £, GH₵, R, and د.إ contribution circles.'],
  ['Smart Calculator', 'Plan savings, payout order, contribution amount, and group size before you begin.'],
  ['Secure and Transparent', 'Password hashing, signed API access, clear activity history, and private server hosting.'],
  ['Instant Reminders', 'Keep members aware of payment dates, payout turns, and group activity.'],
];

const reviews = [
  ['Chioma A.', 'Group Admin', "My Ajo transformed how our family saves. No more missed contributions or confusion about who is next."],
  ['Emeka O.', 'Member', 'I saved ₦600,000 in six months with my work colleagues. The app made it easy to stay consistent.'],
  ['Aisha M.', 'Group Admin', 'The admin tools are fantastic. I can manage multiple groups and everyone stays accountable.'],
];

function SectionTitle({ label, title }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: 42 }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--gold)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </div>
      <h2 style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 'clamp(30px,4vw,44px)', fontWeight: 900, color: 'var(--deep)', letterSpacing: 0 }}>
        {title}
      </h2>
    </div>
  );
}

function HeroPreview() {
  return (
    <div style={{ position: 'relative', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ background: 'rgba(255,255,255,.10)', border: '1px solid rgba(255,255,255,.14)', borderRadius: 26, padding: 20, boxShadow: '0 28px 80px rgba(0,0,0,.25)' }}>
        <div style={{ background: 'var(--white)', color: 'var(--text)', borderRadius: 20, padding: 22, boxShadow: 'var(--sh)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div>
              <div style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 23, fontWeight: 900, color: 'var(--deep)' }}>Family Savings</div>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 3 }}>Monthly rotating circle</div>
            </div>
            <span className="badge b-green">Active</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'var(--mist)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Monthly</div>
              <div style={{ fontFamily: "'Inter','Poppins',sans-serif", color: 'var(--deep)', fontSize: 24, fontWeight: 900 }}>₦50k</div>
            </div>
            <div style={{ background: 'var(--mist)', borderRadius: 14, padding: 14 }}>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Members</div>
              <div style={{ fontFamily: "'Inter','Poppins',sans-serif", color: 'var(--deep)', fontSize: 24, fontWeight: 900 }}>8 / 10</div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 8 }}>
            <span style={{ color: 'var(--muted)' }}>Cycle progress</span>
            <strong style={{ color: 'var(--deep)' }}>4 of 10</strong>
          </div>
          <div className="pw"><div className="pb" style={{ width: '40%' }} /></div>
        </div>
      </div>

      <div style={{ position: 'absolute', right: -8, bottom: -20, background: 'var(--white)', color: 'var(--text)', borderRadius: 18, padding: '14px 16px', boxShadow: '0 18px 45px rgba(0,0,0,.22)', border: '1px solid rgba(0,0,0,.06)' }}>
        <div style={{ fontWeight: 800, color: 'var(--deep)', fontSize: 13 }}>Payout received</div>
        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>₦500,000 sent</div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <div style={{ background: 'var(--white)', minHeight: '100vh', color: 'var(--text)', fontFamily: "'Inter','Poppins',sans-serif" }}>
      <section className="landing-main-hero" style={{ position: 'relative', overflow: 'hidden', background: 'linear-gradient(150deg,#0D4A2E 0%,#0A3D24 58%,#2D5040 100%)', color: 'var(--white)', minHeight: '92vh', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, opacity: .12, background: 'radial-gradient(circle at 12% 18%,#D4A843 0,transparent 28%),radial-gradient(circle at 86% 82%,#E8B860 0,transparent 30%)' }} />
        <div className="landing-main-hero-inner" style={{ position: 'relative', maxWidth: 1180, margin: '0 auto', padding: '34px 22px 64px', width: '100%', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 46, alignItems: 'center' }}>
          <div>
            <Link to="/" style={{display:'inline-flex',alignItems:'center',gap:12,marginBottom:30}}>
              <img src="/logo.png" alt="My Ajo" style={{width:54,height:54,borderRadius:16,objectFit:'cover',boxShadow:'0 12px 30px rgba(0,0,0,.25)'}} />
              <span style={{fontFamily:"'Inter','Poppins',sans-serif",fontWeight:900,fontSize:24,color:'#fff'}}>My Ajo</span>
            </Link>
            <h1 style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 'clamp(43px,6vw,76px)', lineHeight: .98, fontWeight: 900, letterSpacing: 0, marginBottom: 20 }}>
              Save Together,<br />
              <span style={{ color: 'var(--gold-l)' }}>Grow Together</span>
            </h1>
            <p style={{ fontSize: 'clamp(16px,2vw,19px)', color: 'rgba(255,255,255,.72)', maxWidth: 560, lineHeight: 1.75, marginBottom: 30 }}>
              My Ajo digitizes the traditional rotating savings system. Create or join a group, contribute regularly, and receive your payout when it is your turn.
            </p>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 34 }}>
              <Link to="/auth" style={{ background: 'var(--gold)', color: 'var(--deep)', padding: '15px 28px', borderRadius: 12, fontWeight: 900, fontSize: 15 }}>
                Get Started {'->'}
              </Link>
              <a href="#how-it-works" style={{ background: 'rgba(255,255,255,.10)', color: 'var(--white)', padding: '15px 28px', borderRadius: 12, fontWeight: 800, fontSize: 15, border: '1.5px solid rgba(255,255,255,.20)' }}>
                How It Works
              </a>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 14, maxWidth: 560 }}>
              {heroStats.map(([value, label]) => (
                <div key={label} style={{ borderTop: '1px solid rgba(255,255,255,.16)', paddingTop: 13 }}>
                  <div style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 24, fontWeight: 900, color: 'var(--gold-l)' }}>{value}</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,.58)', lineHeight: 1.45 }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          <HeroPreview />
        </div>
      </section>

      <section id="how-it-works" style={{ background: 'var(--white)', padding: '76px 22px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <SectionTitle label="How it works" title="Simple, Transparent, Trustworthy" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 18 }}>
            {steps.map(([n, title, desc]) => (
              <div key={title} style={{ background: 'var(--white)', border: '1px solid rgba(14,26,18,.08)', borderRadius: 16, padding: 22, boxShadow: 'var(--sh)' }}>
                <div style={{ width: 42, height: 42, borderRadius: 13, background: 'var(--deep)', color: 'var(--gold)', fontWeight: 900, display: 'grid', placeItems: 'center', marginBottom: 16 }}>{n}</div>
                <h3 style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 19, fontWeight: 900, color: 'var(--deep)', marginBottom: 8 }}>{title}</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--mist)', padding: '76px 22px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <SectionTitle label="Features" title="Everything You Need" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 18 }}>
            {features.map(([title, desc]) => (
              <div key={title} style={{ background: 'var(--white)', borderRadius: 16, padding: 24, border: '1px solid rgba(14,26,18,.07)', boxShadow: 'var(--sh)' }}>
                <div style={{ width: 44, height: 44, borderRadius: 13, background: 'rgba(200,151,58,.14)', color: 'var(--gold)', display: 'grid', placeItems: 'center', fontWeight: 900, marginBottom: 16 }}>+</div>
                <h3 style={{ fontFamily: "'Inter','Poppins',sans-serif", color: 'var(--deep)', fontSize: 19, fontWeight: 900, marginBottom: 7 }}>{title}</h3>
                <p style={{ color: 'var(--muted)', fontSize: 14, lineHeight: 1.7 }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--white)', padding: '76px 22px' }}>
        <div style={{ maxWidth: 1120, margin: '0 auto' }}>
          <SectionTitle label="Testimonials" title="Loved by Saving Circles" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 18 }}>
            {reviews.map(([name, role, text]) => (
              <div key={name} style={{ background: 'var(--mist)', borderRadius: 16, padding: 24, border: '1px solid rgba(14,26,18,.06)' }}>
                <div style={{ color: 'var(--gold)', letterSpacing: 2, marginBottom: 14 }}>*****</div>
                <p style={{ color: 'var(--text)', lineHeight: 1.75, fontSize: 14, marginBottom: 18 }}>"{text}"</p>
                <div style={{ fontWeight: 900, color: 'var(--deep)' }}>{name}</div>
                <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 3 }}>{role}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--deep)', padding: '76px 22px', textAlign: 'center' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'Inter','Poppins',sans-serif", color: 'var(--white)', fontSize: 'clamp(32px,4vw,48px)', lineHeight: 1.08, fontWeight: 900, marginBottom: 14 }}>
            Ready to Start Saving?
          </h2>
          <p style={{ color: 'rgba(255,255,255,.68)', lineHeight: 1.7, fontSize: 16, marginBottom: 28 }}>
            Join people building financial security through trusted community savings.
          </p>
          <Link to="/auth" style={{ display: 'inline-flex', background: 'var(--gold)', color: 'var(--deep)', padding: '15px 30px', borderRadius: 12, fontWeight: 900 }}>
            Create Your Group {'->'}
          </Link>
        </div>
      </section>

      <footer style={{ background: '#08180F', padding: '24px 22px', color: 'rgba(255,255,255,.56)', fontSize: 12 }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ display:'flex',alignItems:'center',gap:10,fontFamily: "'Inter','Poppins',sans-serif", color: 'var(--white)', fontWeight: 900, fontSize: 18 }}><img src="/logo.png" alt="" style={{width:32,height:32,borderRadius:10}} />My Ajo</div>
            <div style={{ marginTop: 3 }}>Smart savings groups for community contributions</div>
          </div>
          <div>
            <span>{new Date().getFullYear()} My Ajo. All rights reserved.</span><span style={{ marginLeft: 20 }}>Powered by{' '}<a href="https://www.theadekola.online" target="_blank" rel="noreferrer noopener">AAT-Tech Ltd</a></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
