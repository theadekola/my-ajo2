import SvgIcon from '../components/SvgIcon.jsx';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { State } from 'country-state-city';
import { apiPost } from '../api/appClient.js';
import { COUNTRIES, useAuth } from '../context/AuthContext.jsx';
import { inviteJoinPath, readPendingInvite, savePendingInvite } from '../utils/pendingInvite.js';

const NO_POSTCODE_COUNTRIES = new Set(['NG','AE','AG','AO','AW','BF','BI','BJ','BO','BS','BW','BZ','CF','CG','CI','CK','CM','CD','DJ','DM','ER','FJ','GA','GD','GM','GN','GQ','GY','HK','JM','KI','KM','LC','LY','ML','MO','MR','MW','NA','NR','NU','QA','RW','SB','SC','SL','SO','SR','ST','SX','SY','TD','TG','TK','TL','TO','TT','TV','UG','VU','YE','ZW']);
const countryUsesPostcode = countryCode => !NO_POSTCODE_COUNTRIES.has(String(countryCode || '').toUpperCase());

const ADDRESS_FORMATS = {
  NG: {
    stateLabel: 'STATE',
    localityLabel: 'LGA',
    cityLabel: 'CITY / TOWN',
    postalLabel: 'POSTAL CODE',
    states: ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara']
  },
  GH: { stateLabel: 'REGION', localityLabel: 'DISTRICT', cityLabel: 'CITY / TOWN', postalLabel: 'POSTAL CODE', states: ['Ahafo','Ashanti','Bono','Bono East','Central','Eastern','Greater Accra','North East','Northern','Oti','Savannah','Upper East','Upper West','Volta','Western','Western North'] },
  KE: { stateLabel: 'COUNTY', localityLabel: 'SUB-COUNTY', cityLabel: 'CITY / TOWN', postalLabel: 'POSTAL CODE', states: ['Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay','Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii','Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera','Marsabit','Meru','Migori','Mombasa','Muranga','Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta','Tana River','Tharaka-Nithi','Trans Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot'] },
  ZA: { stateLabel: 'PROVINCE', localityLabel: 'MUNICIPALITY', cityLabel: 'CITY / TOWN', postalLabel: 'POSTAL CODE', states: ['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','Northern Cape','North West','Western Cape'] },
  US: { stateLabel: 'STATE', localityLabel: 'COUNTY', cityLabel: 'CITY', postalLabel: 'ZIP CODE', states: ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'] },
  GB: { stateLabel: 'COUNTY / LOCAL AUTHORITY', localityLabel: 'BOROUGH / DISTRICT / TOWN', cityLabel: 'TOWN / CITY', postalLabel: 'POSTCODE', states: [] },
  CA: { stateLabel: 'PROVINCE / TERRITORY', localityLabel: 'REGION / COUNTY', cityLabel: 'CITY', postalLabel: 'POSTAL CODE', states: ['Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador','Northwest Territories','Nova Scotia','Nunavut','Ontario','Prince Edward Island','Quebec','Saskatchewan','Yukon'] },
  FR: { stateLabel: 'REGION', localityLabel: 'DEPARTMENT', cityLabel: 'COMMUNE / CITY', postalLabel: 'POSTAL CODE', states: ['Auvergne-Rhone-Alpes','Bourgogne-Franche-Comte','Brittany','Centre-Val de Loire','Corsica','Grand Est','Hauts-de-France','Ile-de-France','Normandy','Nouvelle-Aquitaine','Occitanie','Pays de la Loire','Provence-Alpes-Cote d Azur'] },
  DE: { stateLabel: 'STATE', localityLabel: 'DISTRICT', cityLabel: 'CITY / TOWN', postalLabel: 'POSTAL CODE', states: ['Baden-Wurttemberg','Bavaria','Berlin','Brandenburg','Bremen','Hamburg','Hesse','Lower Saxony','Mecklenburg-Vorpommern','North Rhine-Westphalia','Rhineland-Palatinate','Saarland','Saxony','Saxony-Anhalt','Schleswig-Holstein','Thuringia'] },
  BR: { stateLabel: 'STATE', localityLabel: 'MUNICIPALITY', cityLabel: 'CITY', postalLabel: 'CEP', states: ['Acre','Alagoas','Amapa','Amazonas','Bahia','Ceara','Distrito Federal','Espirito Santo','Goias','Maranhao','Mato Grosso','Mato Grosso do Sul','Minas Gerais','Para','Paraiba','Parana','Pernambuco','Piaui','Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondonia','Roraima','Santa Catarina','Sao Paulo','Sergipe','Tocantins'] },
  OTHER: { stateLabel: 'STATE / REGION', localityLabel: 'LOCAL AREA', cityLabel: 'CITY / TOWN', postalLabel: 'POSTAL CODE', states: [] }
};

const DEFAULT_ADDRESS_FORMAT = { stateLabel: 'STATE / PROVINCE / REGION', localityLabel: 'DISTRICT / LOCAL AREA', cityLabel: 'CITY / TOWN', postalLabel: 'POSTAL CODE' };
const addressFormatFor = code => ADDRESS_FORMATS[code] || DEFAULT_ADDRESS_FORMAT;
const buildAddress = form => [form.postcode, form.addressLine1, form.addressLine2, form.state, form.locality].filter(Boolean).join(', ');
export const NIGERIA_LGAS = {
  Abia: ['Aba North','Aba South','Arochukwu','Bende','Ikwuano','Isiala Ngwa North','Isiala Ngwa South','Isuikwuato','Obi Ngwa','Ohafia','Osisioma','Ugwunagbo','Ukwa East','Ukwa West','Umuahia North','Umuahia South','Umu Nneochi'],
  Adamawa: ['Demsa','Fufore','Ganye','Girei','Gombi','Guyuk','Hong','Jada','Lamurde','Madagali','Maiha','Mayo-Belwa','Michika','Mubi North','Mubi South','Numan','Shelleng','Song','Toungo','Yola North','Yola South'],
  'Akwa Ibom': ['Abak','Eastern Obolo','Eket','Esit Eket','Essien Udim','Etim Ekpo','Etinan','Ibeno','Ibesikpo Asutan','Ibiono-Ibom','Ika','Ikono','Ikot Abasi','Ikot Ekpene','Ini','Itu','Mbo','Mkpat-Enin','Nsit-Atai','Nsit-Ibom','Nsit-Ubium','Obot Akara','Okobo','Onna','Oron','Oruk Anam','Udung-Uko','Ukanafun','Uruan','Urue-Offong/Oruko','Uyo'],
  Anambra: ['Aguata','Anambra East','Anambra West','Anaocha','Awka North','Awka South','Ayamelum','Dunukofia','Ekwusigo','Idemili North','Idemili South','Ihiala','Njikoka','Nnewi North','Nnewi South','Ogbaru','Onitsha North','Onitsha South','Orumba North','Orumba South','Oyi'],
  Bauchi: ['Alkaleri','Bauchi','Bogoro','Damban','Darazo','Dass','Gamawa','Ganjuwa','Giade','Itas/Gadau','Jamaare','Katagum','Kirfi','Misau','Ningi','Shira','Tafawa Balewa','Toro','Warji','Zaki'],
  Bayelsa: ['Brass','Ekeremor','Kolokuma/Opokuma','Nembe','Ogbia','Sagbama','Southern Ijaw','Yenagoa'],
  Benue: ['Ado','Agatu','Apa','Buruku','Gboko','Guma','Gwer East','Gwer West','Katsina-Ala','Konshisha','Kwande','Logo','Makurdi','Obi','Ogbadibo','Ohimini','Oju','Okpokwu','Otukpo','Tarka','Ukum','Ushongo','Vandeikya'],
  Borno: ['Abadam','Askira/Uba','Bama','Bayo','Biu','Chibok','Damboa','Dikwa','Gubio','Guzamala','Gwoza','Hawul','Jere','Kaga','Kala/Balge','Konduga','Kukawa','Kwaya Kusar','Mafa','Magumeri','Maiduguri','Marte','Mobbar','Monguno','Ngala','Nganzai','Shani'],
  'Cross River': ['Abi','Akamkpa','Akpabuyo','Bakassi','Bekwarra','Biase','Boki','Calabar Municipal','Calabar South','Etung','Ikom','Obanliku','Obubra','Obudu','Odukpani','Ogoja','Yakurr','Yala'],
  Delta: ['Aniocha North','Aniocha South','Bomadi','Burutu','Ethiope East','Ethiope West','Ika North East','Ika South','Isoko North','Isoko South','Ndokwa East','Ndokwa West','Okpe','Oshimili North','Oshimili South','Patani','Sapele','Udu','Ughelli North','Ughelli South','Ukwuani','Uvwie','Warri North','Warri South','Warri South West'],
  Ebonyi: ['Abakaliki','Afikpo North','Afikpo South','Ebonyi','Ezza North','Ezza South','Ikwo','Ishielu','Ivo','Izzi','Ohaozara','Ohaukwu','Onicha'],
  Edo: ['Akoko-Edo','Egor','Esan Central','Esan North-East','Esan South-East','Esan West','Etsako Central','Etsako East','Etsako West','Igueben','Ikpoba-Okha','Oredo','Orhionmwon','Ovia North-East','Ovia South-West','Owan East','Owan West','Uhunmwonde'],
  Ekiti: ['Ado Ekiti','Efon','Ekiti East','Ekiti South-West','Ekiti West','Emure','Gbonyin','Ido-Osi','Ijero','Ikere','Ikole','Ilejemeje','Irepodun/Ifelodun','Ise/Orun','Moba','Oye'],
  Enugu: ['Aninri','Awgu','Enugu East','Enugu North','Enugu South','Ezeagu','Igbo Etiti','Igbo Eze North','Igbo Eze South','Isi Uzo','Nkanu East','Nkanu West','Nsukka','Oji River','Udenu','Udi','Uzo-Uwani'],
  'FCT Abuja': ['Abaji','Bwari','Gwagwalada','Kuje','Kwali','Municipal Area Council'],
  'Federal Capital Territory': ['Abaji','Bwari','Gwagwalada','Kuje','Kwali','Municipal Area Council'],
  Gombe: ['Akko','Balanga','Billiri','Dukku','Funakaye','Gombe','Kaltungo','Kwami','Nafada','Shongom','Yamaltu/Deba'],
  Imo: ['Aboh Mbaise','Ahiazu Mbaise','Ehime Mbano','Ezinihitte','Ideato North','Ideato South','Ihitte/Uboma','Ikeduru','Isiala Mbano','Isu','Mbaitoli','Ngor Okpala','Njaba','Nkwerre','Nwangele','Obowo','Oguta','Ohaji/Egbema','Okigwe','Onuimo','Orlu','Orsu','Oru East','Oru West','Owerri Municipal','Owerri North','Owerri West'],
  Jigawa: ['Auyo','Babura','Biriniwa','Birnin Kudu','Buji','Dutse','Gagarawa','Garki','Gumel','Guri','Gwaram','Gwiwa','Hadejia','Jahun','Kafin Hausa','Kaugama','Kazaure','Kiri Kasama','Kiyawa','Maigatari','Malam Madori','Miga','Ringim','Roni','Sule Tankarkar','Taura','Yankwashi'],
  Kaduna: ['Birnin Gwari','Chikun','Giwa','Igabi','Ikara','Jaba','Jema\'a','Kachia','Kaduna North','Kaduna South','Kagarko','Kajuru','Kaura','Kauru','Kubau','Kudan','Lere','Makarfi','Sabon Gari','Sanga','Soba','Zangon Kataf','Zaria'],
  Kano: ['Ajingi','Albasu','Bagwai','Bebeji','Bichi','Bunkure','Dala','Dambatta','Dawakin Kudu','Dawakin Tofa','Doguwa','Fagge','Gabasawa','Garko','Garun Mallam','Gaya','Gezawa','Gwale','Gwarzo','Kabo','Kano Municipal','Karaye','Kibiya','Kiru','Kumbotso','Kunchi','Kura','Madobi','Makoda','Minjibir','Nasarawa','Rano','Rimin Gado','Rogo','Shanono','Sumaila','Takai','Tarauni','Tofa','Tsanyawa','Tudun Wada','Ungogo','Warawa','Wudil'],
  Katsina: ['Bakori','Batagarawa','Batsari','Baure','Bindawa','Charanchi','Dan Musa','Dandume','Danja','Daura','Dutsi','Dutsin-Ma','Faskari','Funtua','Ingawa','Jibia','Kafur','Kaita','Kankara','Kankia','Katsina','Kurfi','Kusada','Mai\'Adua','Malumfashi','Mani','Mashi','Matazu','Musawa','Rimi','Sabuwa','Safana','Sandamu','Zango'],
  Kebbi: ['Aleiro','Arewa Dandi','Argungu','Augie','Bagudo','Birnin Kebbi','Bunza','Dandi','Fakai','Gwandu','Jega','Kalgo','Koko/Besse','Maiyama','Ngaski','Sakaba','Shanga','Suru','Wasagu/Danko','Yauri','Zuru'],
  Kogi: ['Adavi','Ajaokuta','Ankpa','Bassa','Dekina','Ibaji','Idah','Igalamela Odolu','Ijumu','Kabba/Bunu','Kogi','Lokoja','Mopa-Muro','Ofu','Ogori/Magongo','Okehi','Okene','Olamaboro','Omala','Yagba East','Yagba West'],
  Kwara: ['Asa','Baruten','Edu','Ekiti','Ifelodun','Ilorin East','Ilorin South','Ilorin West','Irepodun','Isin','Kaiama','Moro','Offa','Oke Ero','Oyun','Pategi'],
  Lagos: ['Agege','Ajeromi-Ifelodun','Alimosho','Amuwo-Odofin','Apapa','Badagry','Epe','Eti-Osa','Ibeju-Lekki','Ifako-Ijaiye','Ikeja','Ikorodu','Kosofe','Lagos Island','Lagos Mainland','Mushin','Ojo','Oshodi-Isolo','Shomolu','Surulere'],
  Nasarawa: ['Akwanga','Awe','Doma','Karu','Keana','Keffi','Kokona','Lafia','Nasarawa','Nasarawa Egon','Obi','Toto','Wamba'],
  Niger: ['Agaie','Agwara','Bida','Borgu','Bosso','Chanchaga','Edati','Gbako','Gurara','Katcha','Kontagora','Lapai','Lavun','Magama','Mariga','Mashegu','Mokwa','Moya','Paikoro','Rafi','Rijau','Shiroro','Suleja','Tafa','Wushishi'],
  Ogun: ['Abeokuta North','Abeokuta South','Ado-Odo/Ota','Ewekoro','Ifo','Ijebu East','Ijebu North','Ijebu North East','Ijebu Ode','Ikenne','Imeko Afon','Ipokia','Obafemi Owode','Odeda','Odogbolu','Ogun Waterside','Remo North','Sagamu','Yewa North','Yewa South'],
  Ondo: ['Akoko North-East','Akoko North-West','Akoko South-East','Akoko South-West','Akure North','Akure South','Ese Odo','Idanre','Ifedore','Ilaje','Ile Oluji/Okeigbo','Irele','Odigbo','Okitipupa','Ondo East','Ondo West','Ose','Owo'],
  Osun: ['Atakunmosa East','Atakunmosa West','Aiyedaade','Aiyedire','Boluwaduro','Boripe','Ede North','Ede South','Egbedore','Ejigbo','Ife Central','Ife East','Ife North','Ife South','Ifedayo','Ifelodun','Ila','Ilesa East','Ilesa West','Irepodun','Irewole','Isokan','Iwo','Obokun','Odo Otin','Ola Oluwa','Olorunda','Oriade','Orolu','Osogbo'],
  Oyo: ['Afijio','Akinyele','Atiba','Atisbo','Egbeda','Ibadan North','Ibadan North-East','Ibadan North-West','Ibadan South-East','Ibadan South-West','Ibarapa Central','Ibarapa East','Ibarapa North','Ido','Irepo','Iseyin','Itesiwaju','Iwajowa','Kajola','Lagelu','Ogbomosho North','Ogbomosho South','Ogo Oluwa','Olorunsogo','Oluyole','Ona Ara','Orelope','Ori Ire','Oyo East','Oyo West','Saki East','Saki West','Surulere'],
  Plateau: ['Barkin Ladi','Bassa','Bokkos','Jos East','Jos North','Jos South','Kanam','Kanke','Langtang North','Langtang South','Mangu','Mikang','Pankshin','Qua\'an Pan','Riyom','Shendam','Wase'],
  Rivers: ['Abua/Odual','Ahoada East','Ahoada West','Akuku-Toru','Andoni','Asari-Toru','Bonny','Degema','Eleme','Emohua','Etche','Gokana','Ikwerre','Khana','Obio/Akpor','Ogba/Egbema/Ndoni','Ogu/Bolo','Okrika','Omuma','Opobo/Nkoro','Oyigbo','Port Harcourt','Tai'],
  Sokoto: ['Binji','Bodinga','Dange Shuni','Gada','Goronyo','Gudu','Gwadabawa','Illela','Isa','Kebbe','Kware','Rabah','Sabon Birni','Shagari','Silame','Sokoto North','Sokoto South','Tambuwal','Tangaza','Tureta','Wamako','Wurno','Yabo'],
  Taraba: ['Ardo Kola','Bali','Donga','Gashaka','Gassol','Ibi','Jalingo','Karim Lamido','Kurmi','Lau','Sardauna','Takum','Ussa','Wukari','Yorro','Zing'],
  Yobe: ['Bade','Bursari','Damaturu','Fika','Fune','Geidam','Gujba','Gulani','Jakusko','Karasuwa','Machina','Nangere','Nguru','Potiskum','Tarmuwa','Yunusari','Yusufari'],
  Zamfara: ['Anka','Bakura','Birnin Magaji/Kiyaw','Bukkuyum','Bungudu','Gummi','Gusau','Kaura Namoda','Maradun','Maru','Shinkafi','Talata Mafara','Chafe','Zurmi']
};
function FieldError({ error }) {
  return error ? <div className="registration-field-error" role="alert">{error}</div> : null;
}

function OtpBoxes({ value, onChange, error }) {
  const inputs = useRef([]);
  const digits = String(value || '').replace(/\D/g, '').slice(0, 6);
  const updateDigit = (index, rawValue) => {
    const entered = String(rawValue || '').replace(/\D/g, '');
    if (entered.length > 1) {
      const pasted = entered.slice(0, 6);
      onChange(pasted);
      inputs.current[Math.min(pasted.length, 5)]?.focus();
      return;
    }
    const next = digits.split('');
    next[index] = entered;
    onChange(next.join('').slice(0, 6));
    if (entered && index < 5) inputs.current[index + 1]?.focus();
  };
  const handleKeyDown = (index, event) => {
    if (event.key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === 'ArrowLeft' && index > 0) inputs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < 5) inputs.current[index + 1]?.focus();
  };
  const handlePaste = event => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  };
  return <div className="registration-otp-boxes" role="group" aria-label="Six-digit verification code">
    {Array.from({ length: 6 }, (_, index) => <input
      key={index}
      ref={element => { inputs.current[index] = element; }}
      className="registration-otp-box"
      type="text"
      inputMode="numeric"
      autoComplete={index === 0 ? 'one-time-code' : 'off'}
      pattern="[0-9]*"
      maxLength={1}
      value={digits[index] || ''}
      onChange={event => updateDigit(index, event.target.value)}
      onKeyDown={event => handleKeyDown(index, event)}
      onPaste={handlePaste}
      aria-label={`Verification code digit ${index + 1}`}
      aria-invalid={Boolean(error)}
    />)}
  </div>;
}

function PasswordField({ id, label, value, onChange, placeholder, autoComplete, error }) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="fg">
      <label className="fl" htmlFor={id}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          className="fi"
          id={id}
          aria-invalid={Boolean(error)}
          type={visible ? 'text' : 'password'}
          required
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          style={{ paddingRight: 52 }}
        />
        <button
          type="button"
          onClick={() => setVisible(current => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            border: 'none',
            background: 'transparent',
            color: 'var(--muted)',
            cursor: 'pointer',
            fontSize: 18,
            lineHeight: 1,
            padding: 6
          }}
        >
          {visible ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20C7 20 2.73 16.89 1 12a18.45 18.45 0 0 1 5.06-6.06" />
              <path d="M9.9 4.24A10.75 10.75 0 0 1 12 4c5 0 9.27 3.11 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <path d="M14.12 14.12A3 3 0 0 1 9.88 9.88" />
              <path d="M1 1l22 22" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      <FieldError error={error} />
    </div>
  );
}

export default function Auth() {
  const { login, completeMfaLogin, register, showToast } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const pendingInvite = savePendingInvite(params.get('invite')) || readPendingInvite();
  const postAuthPath = params.get('redirect') || inviteJoinPath(pendingInvite);
  const postRegistrationPath = pendingInvite ? `${inviteJoinPath(pendingInvite)}&join=1` : postAuthPath;
  const [mode, setMode] = useState(pendingInvite ? 'register' : 'login');
  const [emailVerified, setEmailVerified] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});
  const [imageChecking, setImageChecking] = useState(false);
  const registrationFormRef = useRef(null);
  const [welcome, setWelcome] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [mfaTicket, setMfaTicket] = useState('');
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [localities, setLocalities] = useState([]);
  const [profileFile, setProfileFile] = useState(null);
  const [profilePreview, setProfilePreview] = useState('');
  const [form, setForm] = useState({
    title: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    phoneDial: '+234',
    country: 'NG',
    sex: '',
    occupation: '',
    addressLine1: '',
    addressLine2: '',
    locality: '',
    city: '',
    state: '',
    postcode: '',
    password: '',
    confirm: '',
    verificationCode: '',
    registrationTicket: '',
    resetCode: '',
    newPassword: '',
    mfaCode: ''
  });

  const capitalizeWords = value => value.replace(/(^|[\s'-])([a-z])/g, (_, lead, letter) => lead + letter.toUpperCase());
  const titleCaseFields = new Set(['firstName','lastName','occupation','addressLine1','addressLine2','locality','city','state']);
  const set = key => event => {
    let value = event.target.value;
    if (titleCaseFields.has(key)) value = capitalizeWords(value);
    if (key === 'postcode') value = value.toUpperCase();
    setFieldErrors(current => ({ ...current, [key]: '' }));
    setForm(current => key === 'email' && value !== current.email
      ? { ...current, email: value, verificationCode: '', registrationTicket: '' }
      : { ...current, [key]: value });
    if (key === 'email') {
      setEmailVerified(false);
      setOtpSent(false);
      setResendSeconds(0);
    }
  };
  const setCountry = event => {
    const countryCode = event.target.value;
    const selectedCountry = COUNTRIES.find(item => item.code === countryCode);
    setForm(current => ({
      ...current,
      country: countryCode,
      phoneDial: selectedCountry?.dial || current.phoneDial,
      state: '',
      locality: '',
      city: '',
      postcode: ''
    }));
  };
  const country = COUNTRIES.find(c => c.code === form.country) || COUNTRIES[0];
  const addressFormat = addressFormatFor(country.code);
  const usesPostcode = countryUsesPostcode(country.code);
  const subdivisions = State.getStatesOfCountry(country.code)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const selectedSubdivision = subdivisions.find(item => item.name === form.state);
  const setSubdivision = event => setForm(current => ({ ...current, state: event.target.value, locality: '' }));

  useEffect(() => {
    let active = true;
    if (!selectedSubdivision) {
      setLocalities([]);
      return () => { active = false; };
    }
    if (country.code === 'NG') {
      setLocalities([...(NIGERIA_LGAS[selectedSubdivision.name] || [])].sort((a, b) => a.localeCompare(b)));
      return () => { active = false; };
    }
    import('country-state-city').then(({ City }) => {
      if (!active) return;
      const places = City.getCitiesOfState(country.code, selectedSubdivision.isoCode)
        .map(item => item.name)
        .filter((name, index, names) => index === 0 || name !== names[index - 1])
        .sort((a, b) => a.localeCompare(b));
      setLocalities(places);
    }).catch(() => active && setLocalities([]));
    return () => { active = false; };
  }, [country.code, selectedSubdivision?.name, selectedSubdivision?.isoCode]);

  useEffect(() => () => {
    if (profilePreview) URL.revokeObjectURL(profilePreview);
  }, [profilePreview]);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = window.setInterval(() => setResendSeconds(seconds => Math.max(0, seconds - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);


  const startRegister = () => {
    setMode('register');
    setEmailVerified(false);
    setOtpSent(false);
    setTermsAccepted(false);
    setMarketingConsent(false);
    setResendSeconds(0);
    setFieldErrors({});
    setWelcome(false);
    setProfileFile(null);
    setProfilePreview('');
    setErr('');
  };

  const selectProfilePicture = async event => {
    const file = event.target.files?.[0];
    setErr('');
    if (!file) return;
    setImageChecking(true);
    setFieldErrors(current => ({ ...current, profilePicture: '' }));
    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!['jpg','jpeg','png','webp','heic','heif'].includes(extension) || !file.type.startsWith('image/')) throw new Error('Choose a JPG, PNG, WebP, HEIC or HEIF image.');
      if (file.size > 5 * 1024 * 1024) throw new Error('Profile picture must be 5 MB or smaller.');
      await file.slice(0, 32).arrayBuffer();
      setProfileFile(file);
      setProfilePreview(URL.createObjectURL(file));
    } catch (error) {
      setProfileFile(null);
      setProfilePreview('');
      setFieldErrors(current => ({ ...current, profilePicture: error.message }));
    } finally {
      setImageChecking(false);
    }
  };


  const doLogin = async event => {
    event.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const response = await login(form.email, form.password);
      if(response.mfaRequired){
        setMfaTicket(response.mfaTicket);
        setMode('mfa');
        setBusy(false);
        return;
      }
      navigate(postAuthPath, { replace: true });
    } catch (ex) {
      setErr(ex.message);
      setBusy(false);
    }
  };

  const sendRegisterCode = async event => {
    event?.preventDefault?.();
    setErr('');
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setFieldErrors(current => ({ ...current, email: 'Enter a valid email address.' }));
      return;
    }
    setBusy(true);
    try {
      await apiPost('/auth/register/otp', { email: form.email });
      setEmailVerified(false);
      setOtpSent(true);
      setResendSeconds(60);
      setForm(current => ({ ...current, verificationCode: '', registrationTicket: '' }));
      showToast?.('Verification code sent');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyRegisterCode = async event => {
    event?.preventDefault?.();
    setErr('');
    if (!/^\d{6}$/.test(form.verificationCode)) {
      setFieldErrors(current => ({ ...current, verificationCode: 'Enter the six-digit code.' }));
      return;
    }
    setBusy(true);
    try {
      const result = await apiPost('/auth/register/verify', { email: form.email, code: form.verificationCode });
      setForm(current => ({ ...current, registrationTicket: result.registrationTicket }));
      setEmailVerified(true);
      setFieldErrors(current => ({ ...current, email: '', verificationCode: '' }));
      showToast?.('Email verified');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const verifyMfaLogin = async event => {
    event.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await completeMfaLogin(mfaTicket,useRecoveryCode?'':form.mfaCode,useRecoveryCode?form.mfaCode:'');
      navigate(postAuthPath,{replace:true});
    } catch(ex) { setErr(ex.message); setBusy(false); }
  };
  const completeRegistration = async event => {
    event.preventDefault();
    setErr('');
    const errors = {};
    const required = { title:'Select a title.', firstName:'Enter your first name.', lastName:'Enter your last name.', sex:'Select an option.', occupation:'Enter your occupation.', phone:'Enter your phone number.', addressLine1:'Enter address line 1.', state:`Select or enter your ${addressFormat.stateLabel.toLowerCase()}.` };
    Object.entries(required).forEach(([key,message]) => { if (!String(form[key] || '').trim()) errors[key] = message; });
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) errors.email = 'Enter a valid email address.';
    else if (!emailVerified || !form.registrationTicket) errors.email = 'Verify this email address before creating your account.';
    if (form.password.length < 12 || !/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/\d/.test(form.password) || !/[^A-Za-z0-9]/.test(form.password)) errors.password = 'Password does not meet every requirement.';
    if (form.password !== form.confirm) errors.confirm = 'Passwords do not match.';
    if (usesPostcode && !form.postcode.trim()) errors.postcode = `Enter your ${addressFormat.postalLabel.toLowerCase()}.`;
    if (!usesPostcode && !form.locality.trim()) errors.locality = `Enter your ${addressFormat.localityLabel.toLowerCase()}.`;
    if (!profileFile) errors.profilePicture = 'A profile picture is required.';
    if (!termsAccepted) errors.termsAccepted = 'You must accept the Terms of Service and Privacy Policy.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      window.requestAnimationFrame(() => {
        const first = registrationFormRef.current?.querySelector('[aria-invalid="true"], .registration-field-error');
        first?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        first?.focus?.({ preventScroll: true });
      });
      return;
    }
    setBusy(true);
    try {
      await register({
        title: form.title,
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        dialCode: form.phoneDial,
        password: form.password,
        registrationTicket: form.registrationTicket,
        countryCode: country.code,
        currencyCode: country.cur,
        currencySymbol: country.sym,
        sex: form.sex,
        occupation: form.occupation,
        address: buildAddress(form),
        termsAccepted: 'true',
        marketingConsent: marketingConsent ? 'true' : 'false'
      }, profileFile);
      setWelcome(true);
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const doForgot = async event => {
    event.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await apiPost('/auth/password-reset/otp', { email: form.email });
      setResetEmail(form.email);
      setMode('reset');
      showToast?.('Reset code sent to your email');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const doReset = async event => {
    event.preventDefault();
    setErr('');
    setBusy(true);
    try {
      if (form.newPassword.length < 12) throw new Error('Password must be at least 12 characters');
      await apiPost('/auth/reset-password', { email: resetEmail, code: form.resetCode, newPassword: form.newPassword });
      showToast?.('Password reset! Please sign in.');
      setMode('login');
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setBusy(false);
    }
  };

  const passwordRules = [
    ['At least 12 characters', form.password.length >= 12],
    ['Uppercase and lowercase letters', /[A-Z]/.test(form.password) && /[a-z]/.test(form.password)],
    ['A number', /\d/.test(form.password)],
    ['A special character', /[^A-Za-z0-9]/.test(form.password)]
  ];
  const registrationReady = Boolean(
    form.title && form.firstName.trim() && form.lastName.trim() && form.sex && form.occupation.trim()
    && emailVerified && form.registrationTicket && passwordRules.every(([,valid]) => valid)
    && form.password === form.confirm && form.phone.trim() && form.addressLine1.trim()
    && form.state.trim() && form.locality.trim() && (!usesPostcode || form.postcode.trim())
    && profileFile && termsAccepted && !imageChecking && !busy
  );


  const Left = () => (
    <div className="auth-panel" style={{ width: 420, flexShrink: 0, background: 'var(--deep)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 44, minHeight: '100vh' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img src="/logo.png" alt="My Ajo" style={{ width: 44, height: 44, borderRadius: 14, objectFit: 'cover', boxShadow: '0 8px 20px rgba(0,0,0,.18)' }} />
        <div>
          <div style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 20, fontWeight: 800, color: 'var(--white)' }}>My Ajo</div>
          <div style={{ fontSize: 10, color: 'var(--gold)', letterSpacing: 2, textTransform: 'uppercase' }}>Smart Savings Groups</div>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 30, fontWeight: 900, color: 'var(--white)', lineHeight: 1.2, marginBottom: 14 }}>
          Save together,<br /><span style={{ color: 'var(--gold)' }}>thrive together</span>
        </div>
        <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.6)', lineHeight: 1.7 }}>
          Join thousands of people using My Ajo to run transparent, trusted savings groups.
        </p>
      </div>
      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.35)' }}>
        <Link to="/terms" style={{ color: 'rgba(255,255,255,.5)', marginRight: 16 }}>Terms</Link>
        <Link to="/privacy" style={{ color: 'rgba(255,255,255,.5)' }}>Privacy</Link>
      </div>
    </div>
  );

  return (
    <div className={`auth-shell auth-${mode}`} style={{ display: 'flex', minHeight: '100vh', fontFamily: "'Inter','Poppins',sans-serif" }}>
      <div style={{ display: 'none', width: 420 }} className="auth-left"><Left /></div>
      <Left />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
        <div style={{ width: '100%', maxWidth: mode === 'register' ? 760 : 440 }}>
          {mode === 'login' && (
            <>
              <h2 style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 26, fontWeight: 900, color: 'var(--deep)', marginBottom: 6 }}>Welcome back</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>Sign in to manage your circles.</p>
              {err && <div className="err-msg">{err}</div>}
              <form onSubmit={doLogin}>
                <div className="fg"><label className="fl">EMAIL</label><input className="fi" type="email" required value={form.email} onChange={set('email')} placeholder="you@email.com" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck="false" /></div>
                <PasswordField label="PASSWORD" value={form.password} onChange={set('password')} placeholder="Your password" autoComplete="current-password" />
                <div style={{ textAlign: 'right', marginBottom: 16 }}><button type="button" onClick={() => { setMode('forgot'); setErr(''); }} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Forgot password?</button></div>
                <button className="btn btn-g" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center', padding: 13, fontSize: 15 }}>{busy ? 'Signing in...' : 'Sign In ->'}</button>
              </form>
              <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'var(--muted)' }}>
                No account? <button onClick={startRegister} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Register</button>
              </div>
            </>
          )}

          {mode === 'mfa' && (
            <>
              <h2 style={{fontSize:26,fontWeight:900,color:'var(--deep)',marginBottom:6}}>Verify your identity</h2>
              <p style={{fontSize:13,color:'var(--muted)',marginBottom:24}}>
                {useRecoveryCode?'Enter one unused recovery code.':'Enter the six-digit code from your authenticator app.'}
              </p>
              {err && <div className="err-msg">{err}</div>}
              <form onSubmit={verifyMfaLogin}>
                <div className="fg"><label className="fl">{useRecoveryCode?'RECOVERY CODE':'AUTHENTICATOR CODE'}</label>
                  <input className="fi" required autoFocus inputMode={useRecoveryCode?'text':'numeric'} autoComplete="one-time-code"
                    value={form.mfaCode} onChange={set('mfaCode')} maxLength={useRecoveryCode?20:6}/>
                </div>
                <button className="btn btn-g" type="submit" disabled={busy} style={{width:'100%',justifyContent:'center',padding:13}}>{busy?'Verifying...':'Verify and sign in'}</button>
              </form>
              <button type="button" onClick={()=>{setUseRecoveryCode(value=>!value);setForm(current=>({...current,mfaCode:''}));setErr('');}}
                style={{display:'block',margin:'16px auto',border:0,background:'none',color:'var(--gold)',cursor:'pointer'}}>
                {useRecoveryCode?'Use authenticator code':'Use a recovery code'}
              </button>
            </>
          )}

          {mode === 'register' && welcome && (
            <div style={{ textAlign: 'center', background: 'var(--white)', borderRadius: 18, padding: 30, boxShadow: '0 12px 30px rgba(0,0,0,.06)' }}>
              <div style={{ marginBottom: 10, color: 'var(--gold)' }}><SvgIcon name="sparkle" size={42} /></div>
              <div style={{ fontSize: 24, fontWeight: 900, color: 'var(--deep)', marginBottom: 8 }}>Welcome, {form.firstName}</div>
              <p style={{ color: 'var(--muted)', fontSize: 13, marginBottom: 20 }}>{pendingInvite ? 'Your account is ready. Continue to join the group you were invited to.' : 'Your member account is ready. Continue to your dashboard to start using My Ajo.'}</p>
              <button className="btn btn-g" type="button" onClick={() => navigate(postRegistrationPath, { replace: true })} style={{ width: '100%', justifyContent: 'center', padding: 13 }}>{pendingInvite ? 'Continue to Join Group' : 'Continue to Dashboard'}</button>
            </div>
          )}

          {mode === 'register' && !welcome && (
            <section className="registration-page" aria-labelledby="registration-title">
              <h2 id="registration-title">Create your account</h2>
              <p className="registration-intro">Complete the form, verify your email, and create your secure Member account.</p>
              {err && <div className="err-msg" role="alert">{err}</div>}
              <form ref={registrationFormRef} className="registration-form" onSubmit={completeRegistration} noValidate>
                <fieldset className="registration-section">
                  <legend>1. Personal details</legend>
                  <div className="registration-grid">
                    <div className="fg"><label className="fl" htmlFor="reg-title">TITLE</label><select id="reg-title" className="fs" value={form.title} onChange={set('title')} aria-invalid={Boolean(fieldErrors.title)}><option value="">Select title</option><option>Mr</option><option>Mrs</option><option>Ms</option><option>Dr</option><option>Prof</option></select><FieldError error={fieldErrors.title}/></div>
                    <div className="fg"><label className="fl" htmlFor="reg-first-name">FIRST NAME</label><input id="reg-first-name" className="fi" value={form.firstName} onChange={set('firstName')} autoComplete="given-name" aria-invalid={Boolean(fieldErrors.firstName)}/><FieldError error={fieldErrors.firstName}/></div>
                    <div className="fg"><label className="fl" htmlFor="reg-last-name">LAST NAME</label><input id="reg-last-name" className="fi" value={form.lastName} onChange={set('lastName')} autoComplete="family-name" aria-invalid={Boolean(fieldErrors.lastName)}/><FieldError error={fieldErrors.lastName}/></div>
                    <div className="fg"><label className="fl" htmlFor="reg-sex">SEX</label><select id="reg-sex" className="fs" value={form.sex} onChange={set('sex')} aria-invalid={Boolean(fieldErrors.sex)}><option value="">Select an option</option><option>Male</option><option>Female</option><option>Prefer not to say</option></select><FieldError error={fieldErrors.sex}/></div>
                    <div className="fg registration-span"><label className="fl" htmlFor="reg-occupation">OCCUPATION</label><input id="reg-occupation" className="fi" value={form.occupation} onChange={set('occupation')} autoComplete="organization-title" aria-invalid={Boolean(fieldErrors.occupation)}/><FieldError error={fieldErrors.occupation}/></div>
                  </div>
                </fieldset>

                <fieldset className="registration-section">
                  <legend>2. Email verification</legend>
                  <p className="registration-help">We create no account until this email address is verified.</p>
                  <div className="registration-email-row">
                    <div className="fg"><label className="fl" htmlFor="reg-email">EMAIL ADDRESS</label><input id="reg-email" className="fi" type="email" value={form.email} onChange={set('email')} inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck="false" aria-invalid={Boolean(fieldErrors.email)}/><FieldError error={fieldErrors.email}/></div>
                    <button className="btn btn-gh" type="button" onClick={sendRegisterCode} disabled={busy || emailVerified || resendSeconds > 0}>{busy ? 'Sending…' : otpSent && resendSeconds > 0 ? `Resend in ${resendSeconds}s` : otpSent ? 'Resend code' : 'Send verification code'}</button>
                  </div>
                  {otpSent && !emailVerified && <div className="registration-email-row registration-code-row">
                    <div className="fg"><span className="fl">SIX-DIGIT CODE</span><OtpBoxes value={form.verificationCode} error={fieldErrors.verificationCode} onChange={verificationCode => { setForm(current => ({ ...current, verificationCode })); setFieldErrors(current => ({ ...current, verificationCode: '' })); }}/><FieldError error={fieldErrors.verificationCode}/></div>
                    <button className="btn btn-g" type="button" onClick={verifyRegisterCode} disabled={busy || form.verificationCode.length !== 6}>{busy ? 'Checking…' : 'Verify code'}</button>
                  </div>}
                  {emailVerified && <div className="registration-verified"><SvgIcon name="check" size={18}/> Email verified</div>}
                </fieldset>

                <fieldset className="registration-section">
                  <legend>3. Password</legend>
                  <div className="registration-grid">
                    <PasswordField id="reg-password" label="PASSWORD" value={form.password} onChange={set('password')} placeholder="Create a strong password" autoComplete="new-password" error={fieldErrors.password}/>
                    <PasswordField id="reg-confirm" label="CONFIRM PASSWORD" value={form.confirm} onChange={set('confirm')} placeholder="Repeat your password" autoComplete="new-password" error={fieldErrors.confirm}/>
                  </div>
                  <ul className="password-requirements" aria-live="polite">{passwordRules.map(([label,valid]) => <li className={valid?'valid':''} key={label}><SvgIcon name={valid?'check':'clock'} size={14}/>{label}</li>)}</ul>
                </fieldset>

                <fieldset className="registration-section">
                  <legend>4. Contact and location</legend>
                  <div className="registration-grid">
                    <div className="fg"><label className="fl" htmlFor="reg-country">COUNTRY</label><select id="reg-country" className="fs" value={form.country} onChange={setCountry}>{COUNTRIES.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}</select></div>
                    <div className="fg"><label className="fl" htmlFor="reg-dial">COUNTRY DIALLING CODE</label><select id="reg-dial" className="fs" value={form.phoneDial} onChange={set('phoneDial')}>{COUNTRIES.map(item => <option key={`${item.code}-${item.dial}`} value={item.dial}>{item.code} {item.dial}</option>)}</select></div>
                    <div className="fg registration-span"><label className="fl" htmlFor="reg-phone">PHONE NUMBER</label><input id="reg-phone" className="fi" type="tel" value={form.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel-national" aria-invalid={Boolean(fieldErrors.phone)}/><FieldError error={fieldErrors.phone}/></div>
                    <div className="fg registration-span"><label className="fl" htmlFor="reg-address-1">ADDRESS LINE 1</label><input id="reg-address-1" className="fi" value={form.addressLine1} onChange={set('addressLine1')} autoComplete="address-line1" aria-invalid={Boolean(fieldErrors.addressLine1)}/><FieldError error={fieldErrors.addressLine1}/></div>
                    <div className="fg registration-span"><label className="fl" htmlFor="reg-address-2">ADDRESS LINE 2 (OPTIONAL)</label><input id="reg-address-2" className="fi" value={form.addressLine2} onChange={set('addressLine2')} autoComplete="address-line2"/></div>
                    <div className="fg"><label className="fl" htmlFor="reg-state">{addressFormat.stateLabel}</label>{subdivisions.length ? <select id="reg-state" className="fs" value={form.state} onChange={setSubdivision} aria-invalid={Boolean(fieldErrors.state)}><option value="">Select {addressFormat.stateLabel.toLowerCase()}</option>{subdivisions.map(item => <option key={item.isoCode} value={item.name}>{item.name}</option>)}</select> : <input id="reg-state" className="fi" value={form.state} onChange={set('state')} aria-invalid={Boolean(fieldErrors.state)}/>}<FieldError error={fieldErrors.state}/></div>
                    <div className="fg"><label className="fl" htmlFor="reg-locality">{addressFormat.localityLabel}</label>{localities.length ? <select id="reg-locality" className="fs" value={form.locality} onChange={set('locality')} aria-invalid={Boolean(fieldErrors.locality)}><option value="">Select {addressFormat.localityLabel.toLowerCase()}</option>{localities.map(item => <option key={item} value={item}>{item}</option>)}</select> : <input id="reg-locality" className="fi" value={form.locality} onChange={set('locality')} aria-invalid={Boolean(fieldErrors.locality)} placeholder={selectedSubdivision ? `Enter ${addressFormat.localityLabel.toLowerCase()}` : `Select ${addressFormat.stateLabel.toLowerCase()} first`}/>}<FieldError error={fieldErrors.locality}/></div>
                    {usesPostcode && <div className="fg registration-span"><label className="fl" htmlFor="reg-postcode">{addressFormat.postalLabel}</label><input id="reg-postcode" className="fi" value={form.postcode} onChange={set('postcode')} autoComplete="postal-code" aria-invalid={Boolean(fieldErrors.postcode)}/><FieldError error={fieldErrors.postcode}/></div>}
                  </div>
                </fieldset>

                <fieldset className="registration-section">
                  <legend>5. Profile picture</legend>
                  <div className="registration-photo">
                    <div className="registration-photo-preview">{profilePreview ? <img src={profilePreview} alt="Selected profile"/> : <SvgIcon name="user" size={38}/>}</div>
                    <div><p>A profile picture is required. Choose a JPG, PNG, WebP, HEIC or HEIF image up to 5 MB.</p><label className="btn btn-gh" htmlFor="registration-profile-picture">{imageChecking ? 'Checking image…' : profileFile ? 'Change photo' : 'Upload or choose photo'}</label><input id="registration-profile-picture" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" onChange={selectProfilePicture} disabled={imageChecking}/><FieldError error={fieldErrors.profilePicture}/></div>
                  </div>
                </fieldset>

                <fieldset className="registration-section">
                  <legend>6. Consent</legend>
                  <label className="registration-check"><input type="checkbox" checked={termsAccepted} onChange={event => { setTermsAccepted(event.target.checked); setFieldErrors(current => ({...current,termsAccepted:''})); }} aria-invalid={Boolean(fieldErrors.termsAccepted)}/><span>I agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and <Link to="/privacy" target="_blank">Privacy Policy</Link>.</span></label>
                  <FieldError error={fieldErrors.termsAccepted}/>
                  <label className="registration-check"><input type="checkbox" checked={marketingConsent} onChange={event => setMarketingConsent(event.target.checked)}/><span>Send me product news and promotional messages. (Optional)</span></label>
                </fieldset>

                <div className="registration-submit"><button className="btn btn-g" type="submit" disabled={!registrationReady}>{busy ? 'Creating account…' : imageChecking ? 'Checking image…' : 'Create My Ajo Account'}</button></div>
                <div className="registration-signin">Already have an account? <button type="button" onClick={() => { setMode('login'); setErr(''); }}>Sign in</button></div>
              </form>
            </section>
          )}

          {mode === 'forgot' && (
            <>
              <h2 style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 24, fontWeight: 900, color: 'var(--deep)', marginBottom: 6 }}>Forgot password?</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Enter your email and we will send a reset code. If the code is not in your inbox, please check your Spam or Junk folder.</p>
              {err && <div className="err-msg">{err}</div>}
              <form onSubmit={doForgot}>
                <div className="fg"><label className="fl">EMAIL ADDRESS</label><input className="fi" type="email" required value={form.email} onChange={set('email')} placeholder="you@email.com" /></div>
                <button className="btn btn-g" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center', padding: 13 }}>{busy ? 'Sending...' : 'Send Reset Code'}</button>
              </form>
              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13 }}><button onClick={() => { setMode('login'); setErr(''); }} style={{ background: 'none', border: 'none', color: 'var(--gold)', fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>Back to Sign In</button></div>
            </>
          )}

          {mode === 'reset' && (
            <>
              <h2 style={{ fontFamily: "'Inter','Poppins',sans-serif", fontSize: 24, fontWeight: 900, color: 'var(--deep)', marginBottom: 6 }}>Reset password</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 20 }}>Enter the 6-digit code sent to <strong>{resetEmail}</strong>. If you cannot find it, please check your Spam or Junk folder.</p>
              {err && <div className="err-msg">{err}</div>}
              <form onSubmit={doReset}>
                <div className="fg"><label className="fl">VERIFICATION CODE</label><input className="fi" maxLength={6} required value={form.resetCode} onChange={set('resetCode')} placeholder="123456" style={{ letterSpacing: 6, fontSize: 20, fontWeight: 700, textAlign: 'center' }} inputMode="numeric" /></div>
                <PasswordField label="NEW PASSWORD" value={form.newPassword} onChange={set('newPassword')} placeholder="Min. 12 characters" autoComplete="new-password" />
                <button className="btn btn-g" type="submit" disabled={busy} style={{ width: '100%', justifyContent: 'center', padding: 13 }}>{busy ? 'Resetting...' : 'Reset Password'}</button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}













