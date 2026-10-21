import React from 'react';
import { afterEach,beforeEach,describe,it,expect,vi } from 'vitest';
import { render,screen,fireEvent,waitFor,cleanup,act } from '@testing-library/react';
import { MemoryRouter,Routes,Route } from 'react-router-dom';
const mocks=vi.hoisted(()=>({get:vi.fn(),post:vi.fn(),put:vi.fn(),user:null,toast:vi.fn()}));
vi.mock('../src/api/appClient.js',()=>({apiGet:mocks.get,apiPost:mocks.post,apiPublicPost:mocks.post,apiPut:mocks.put,apiDelete:vi.fn(),apiUpload:vi.fn(),apiUrl:p=>p,apiAssetUrl:p=>p,resetApiSecurity:vi.fn()}));
vi.mock('../src/context/AuthContext.jsx',async original=>({...await original(),useAuth:()=>({user:mocks.user,loading:false,showToast:mocks.toast,fmt:n=>'₦'+Number(n||0),sym:'₦',unread:0,setUnread:vi.fn(),refreshUser:vi.fn(),setUser:vi.fn(),canCreateGroups:true,logout:vi.fn(),initials:'TA',completeMfaLogin:vi.fn(),startSuperAdminMfa:vi.fn(),login:vi.fn()})}));
import App from '../src/App.jsx';
import MakePayment from '../src/pages/MakePayment.jsx';
import GroupPayments from '../src/pages/GroupPayments.jsx';
const user={UserId:3,FirstName:'Test',LastName:'Admin',Title:'Mr',Email:'test@example.invalid',CountryCode:'NG',CurrencyCode:'NGN',SystemRole:'SuperAdmin',MfaEnabled:1,MfaVerifiedAt:'2026-10-21T00:00:00Z',IsActive:1,IsEmailVerified:1,OnboardingDone:1,BankName:'Test bank',BankAccountNumber:'1234567890',BankAccountName:'Test Admin',CreatedAt:'2026-01-01'};
const members=[{...user,MemberId:1,Role:'Admin',Status:'Approved',SlotNumber:1},{...user,UserId:7,MemberId:2,FirstName:'Other',LastName:'Member',Role:'Member',Status:'Approved',SlotNumber:2}];
const group={GroupId:2,GroupName:'Audit circle',AdminUserId:3,CountryCode:'NG',CurrencyCode:'NGN',ContributionAmount:100,Frequency:'Monthly',CurrentCycle:1,MemberCount:2,MaxMembers:2,PaidCount:0,CollectedThisCycle:0,Role:'Admin',Status:'Active',members};
const contributions=[{ContributionId:1,UserId:7,GroupId:2,MemberName:'Other Member',Amount:100,Status:'Pending',CycleNumber:1,Method:'BankTransfer',PaidAt:'2026-10-20'}];
function data(path){
 const p=path.split('?')[0];
 if(p==='/users/dashboard')return {ActiveGroups:1};if(p==='/groups')return [group];if(p==='/groups/2')return group;if(p==='/members/2')return members;
 if(p.startsWith('/contributions'))return contributions;
 if(p==='/payouts/member/2')return {payouts:[],groupName:'Audit circle'};if(p.startsWith('/payouts'))return [];
 if(p==='/groups/2/statistics')return {summary:{...group,IsAdmin:true},ranking:[],cycles:[],contributionStatus:[],payoutStatus:[]};
 if(p==='/payment-info/2')return {BankName:'Test bank',AccountNumber:'1234567890',AccountName:'Audit circle'};
 if(p.startsWith('/invites')||p.startsWith('/messages'))return [];
 if(p==='/notifications')return path.includes('paged=1')?{items:[],unread:0,hasMore:false}:[];
 if(p.startsWith('/dashboard/activity'))return {items:[]};if(p==='/insights/summary')return {text:'No confirmed payments'};
 if(p==='/system-admin/access')return {role:'SuperAdmin',permissions:[],canExport:true};
 if(p==='/system-admin/users/7')return {user:{...user,UserId:7},groups:[],audit:[]};
 if(p==='/system-admin/overview')return {metrics:{Users:2},status:{api:'Operational'}};
 if(p.startsWith('/system-admin'))return {rows:[]};
 if(p==='/push/public-key')return {enabled:false};if(p==='/health')return {ok:true};return {};
}
beforeEach(()=>{mocks.user={...user};mocks.get.mockImplementation(async p=>data(p));mocks.post.mockResolvedValue({ok:true});mocks.put.mockResolvedValue({updated:true});mocks.toast.mockClear();});
afterEach(()=>{cleanup();vi.clearAllMocks();});
const paths=['/','/dashboard','/groups','/groups/create','/group/2','/group/2/members','/group/2/members/2/profile','/group/2/members/2/transactions','/group/2/members/2/transactions/export','/group/2/invite-codes','/group/2/payments','/group/2/contributions','/group/2/chat','/group/2/statistics','/group/2/pay','/group/2/bank','/group/2/payment-info','/group/2/disbursement','/group/2/payout-date','/group/2/direct-debit','/contributions','/calendar','/calculator','/profile','/notifications','/notification-settings','/security/mfa','/help','/terms','/privacy','/more','/install','/user-guide','/support-email','/ask-ai','/system-admin','/system-admin/users','/system-admin/users/7','/system-admin/groups','/system-admin/transactions','/system-admin/security','/system-admin/audit-logs','/system-admin/support','/system-admin/reports','/system-admin/administrators','/system-admin/settings','/system-admin/security/mfa/setup'];
describe('route render smoke with mocked API contracts (no visual/device acceptance)',()=>{
 for(const path of paths)it(path,async()=>{
   const errors=[];const spy=vi.spyOn(console,'error').mockImplementation((...args)=>errors.push(args.join(' ')));
   try{render(<MemoryRouter initialEntries={[path]}><App/></MemoryRouter>);await act(async()=>{await new Promise(resolve=>setTimeout(resolve,30));});
     await waitFor(()=>expect(document.body.textContent).not.toContain('Loading page…'));
     expect(document.body.textContent).not.toMatch(/This page could not be loaded|Something went wrong/);expect(errors.filter(x=>/Uncaught|The above error|TypeError|ReferenceError/.test(x))).toEqual([]);
   }finally{spy.mockRestore();}
 });
 it('unauthenticated auth form',async()=>{mocks.user=null;render(<MemoryRouter initialEntries={['/auth']}><App/></MemoryRouter>);await screen.findByRole('button',{name:/^Sign In/});});
});
it('Pay Again permits a second receipt submission',async()=>{
 render(<MemoryRouter initialEntries={['/group/2/pay']}><Routes><Route path="/group/:id/pay" element={<MakePayment/>}/></Routes></MemoryRouter>);
 await waitFor(()=>expect(document.querySelector('input[type=file]').disabled).toBe(false));
 const choose=()=>fireEvent.change(document.querySelector('input[type=file]'),{target:{files:[new File(['receipt'],'receipt.png',{type:'image/png'})]}});
 choose();fireEvent.submit(document.querySelector('form'));await screen.findByRole('button',{name:'Pay Again'});fireEvent.click(screen.getByRole('button',{name:'Pay Again'}));choose();
 expect(screen.getByRole('button',{name:'Submit Payment'}).disabled).toBe(false);
});
it('a failed contribution approval remains open and shows the error',async()=>{
 mocks.put.mockRejectedValue(new Error('Already reviewed'));
 render(<MemoryRouter initialEntries={['/group/2/payments']}><Routes><Route path="/group/:id/payments" element={<GroupPayments/>}/></Routes></MemoryRouter>);
 fireEvent.click(await screen.findByText('Other Member'));fireEvent.click(screen.getByRole('button',{name:'Confirm Contribution'}));
 await waitFor(()=>expect(mocks.toast).toHaveBeenCalledWith('Already reviewed','error'));
 expect(screen.getByRole('button',{name:'Confirm Contribution'})).toBeTruthy();
});
it('group summary shows zero collected rather than the expected pot',async()=>{
 render(<MemoryRouter initialEntries={['/group/2']}><App/></MemoryRouter>);await screen.findByText('COLLECTED');
 const card=screen.getByText('COLLECTED').parentElement;expect(card.textContent).toContain('₦0');
});
