export interface DeliveryPoint {latitude:number;longitude:number}
export interface DeliveryCandidate extends DeliveryPoint {matchedAddress:string;precision:string;candidateToken?:string;confidence?:number;type?:string;city?:string;area?:string}
export interface CheckoutQuote extends DeliveryPoint {quoteToken:string;expiresAt:number;distanceKm:number;deliveryCharge:number;matchedAddress:string;type:string;checkoutContext:string;addressVersion:number;city?:string;area?:string}
export interface DeliveryState {
  address:string;version:number;requestId:number;status:'idle'|'resolving'|'candidate'|'quoting'|'quoted'|'error'|'expired';
  candidate:DeliveryCandidate|null;candidates:DeliveryCandidate[];pin:DeliveryPoint|null;confirmedPin:DeliveryPoint|null;quote:CheckoutQuote|null;error:string;
}
export const initialDeliveryState=(address='',version=0):DeliveryState=>({address,version,requestId:0,status:'idle',candidate:null,candidates:[],pin:null,confirmedPin:null,quote:null,error:''});
export type DeliveryEvent=
  |{type:'edit';address:string}|{type:'pin';pin:DeliveryPoint|null}|{type:'select';candidate:DeliveryCandidate}
  |{type:'begin';requestId:number;version:number;confirm:boolean}
  |{type:'candidate';requestId:number;version:number;candidate:DeliveryCandidate;candidates:DeliveryCandidate[]}
  |{type:'quote';requestId:number;version:number;quote:CheckoutQuote}
  |{type:'error';requestId:number;version:number;error:string}
  |{type:'tick';now:number}|{type:'reset'};
export function deliveryReducer(state:DeliveryState,event:DeliveryEvent):DeliveryState {
  if(event.type==='edit')return {...initialDeliveryState(event.address,state.version+1),requestId:state.requestId+1};
  if(event.type==='reset')return {...initialDeliveryState(state.address,state.version+1),requestId:state.requestId+1};
  if(event.type==='pin')return {...state,pin:event.pin,version:state.version+1,requestId:state.requestId+1,confirmedPin:null,quote:null,error:'',status:'candidate'};
  if(event.type==='select')return {...state,candidate:event.candidate,pin:event.candidate,version:state.version+1,requestId:state.requestId+1,confirmedPin:null,quote:null,error:'',status:'candidate'};
  if(event.type==='tick')return state.quote&&state.quote.expiresAt<=event.now?{...state,status:'expired',quote:null,confirmedPin:null,error:'Your delivery quote has expired. Confirm the pin or calculate again.'}:state;
  if(event.version!==state.version)return state;
  if(event.type==='begin')return {...state,requestId:event.requestId,status:event.confirm?'quoting':'resolving',quote:null,error:''};
  if(event.requestId!==state.requestId)return state;
  if(event.type==='candidate')return {...state,status:'candidate',candidate:event.candidate,candidates:event.candidates,pin:event.candidate,confirmedPin:null,quote:null};
  if(event.type==='quote')return {...state,status:'quoted',confirmedPin:event.quote.type==='pin'?state.pin:null,quote:event.quote,error:''};
  return {...state,status:'error',quote:null,error:event.error};
}
