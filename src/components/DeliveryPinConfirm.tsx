import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocateFixed, Loader2 } from 'lucide-react';
import { detectDeviceLocation } from '../lib/geolocation';
import { validCoordinates } from '../lib/mapbox';
import type { DeliveryPoint } from '../lib/deliveryCheckout';

const STORE={latitude:33.567341,longitude:73.1044791};
export function DeliveryPinConfirm({point,onChange,disabled=false}:{point:DeliveryPoint|null;onChange:(p:DeliveryPoint|null)=>void;disabled?:boolean}) {
  const host=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),marker=useRef<L.Marker|null>(null);
  const change=useRef(onChange);change.current=onChange;
  const busy=useRef(disabled);busy.current=disabled;
  const gpsController=useRef<AbortController|null>(null),gpsEpoch=useRef(0);
  const [tileError,setTileError]=useState(false),[gps,setGps]=useState(false),[message,setMessage]=useState(''),[accuracy,setAccuracy]=useState<number|null>(null);
  const [latitude,setLatitude]=useState(String(point?.latitude??'')),[longitude,setLongitude]=useState(String(point?.longitude??''));
  const token=(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN||import.meta.env.VITE_MAPBOX_TOKEN||'').trim();

  useEffect(()=>{
    if(!host.current)return;
    const start=point&&validCoordinates(point.latitude,point.longitude)?point:STORE;
    const m=L.map(host.current,{scrollWheelZoom:false}).setView([start.latitude,start.longitude],point?17:15);map.current=m;
    if(token)L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}?access_token=${encodeURIComponent(token)}`,{
      attribution:'<a href="https://www.mapbox.com/about/maps/">© Mapbox</a> <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>',
      tileSize:512,zoomOffset:-1,maxZoom:19,minZoom:8,
    }).on('tileerror',()=>setTileError(true)).on('tileload',()=>setTileError(false)).addTo(m);
    m.on('click',e=>{
      if(busy.current)return;
      gpsEpoch.current++;gpsController.current?.abort();setGps(false);setAccuracy(null);setMessage('');
      change.current({latitude:e.latlng.lat,longitude:e.latlng.lng});
    });
    const observer=typeof ResizeObserver!=='undefined'?new ResizeObserver(()=>m.invalidateSize()):null;observer?.observe(host.current);
    return()=>{observer?.disconnect();gpsController.current?.abort();m.remove();map.current=null;marker.current=null;};
  },[token]);

  useEffect(()=>{
    const m=map.current;if(!m)return;
    if(!point||!validCoordinates(point.latitude,point.longitude)){marker.current?.remove();marker.current=null;return;}
    if(!marker.current){
      const icon=L.divIcon({className:'delivery-pin-icon',html:'<span aria-hidden="true"></span>',iconSize:[28,36],iconAnchor:[14,36]});
      const p=L.marker([point.latitude,point.longitude],{draggable:!busy.current,icon,title:'Drag to your delivery entrance',keyboard:true}).addTo(m);
      p.on('dragend',()=>{if(busy.current)return;const v=p.getLatLng();setAccuracy(null);change.current({latitude:v.lat,longitude:v.lng});});
      marker.current=p;
    }else marker.current.setLatLng([point.latitude,point.longitude]);
    m.setView([point.latitude,point.longitude],Math.max(m.getZoom(),17));
    setLatitude(String(point.latitude));setLongitude(String(point.longitude));
  },[point?.latitude,point?.longitude]);

  useEffect(()=>{if(disabled){map.current?.dragging.disable();marker.current?.dragging?.disable();}else{map.current?.dragging.enable();marker.current?.dragging?.enable();}},[disabled]);

  const locate=async()=>{
    if(disabled||gps)return;
    if(!window.isSecureContext){setMessage('Location sharing requires HTTPS. Tap the map to choose your delivery spot instead.');return;}
    const controller=new AbortController();gpsController.current?.abort();gpsController.current=controller;
    const epoch=++gpsEpoch.current;setGps(true);setMessage('');setAccuracy(null);
    try{
      const position=await detectDeviceLocation(controller.signal);
      if(controller.signal.aborted||epoch!==gpsEpoch.current)return;
      const p={latitude:position.coords.latitude,longitude:position.coords.longitude};
      setAccuracy(position.coords.accuracy);change.current(p);
      map.current?.setView([p.latitude,p.longitude],position.coords.accuracy<=100?18:16);
      setMessage('Location found. Check the pin is on your house or gate before confirming.');
    }catch(error:any){if(!controller.signal.aborted&&epoch===gpsEpoch.current)setMessage(error?.message||'Unable to locate. Tap the map to choose a spot.');}
    finally{if(epoch===gpsEpoch.current)setGps(false);}
  };
  const coordinate=(kind:'latitude'|'longitude',value:string)=>{
    gpsEpoch.current++;gpsController.current?.abort();setGps(false);setAccuracy(null);
    if(kind==='latitude')setLatitude(value);else setLongitude(value);
    const lat=kind==='latitude'?Number(value):Number(latitude),lon=kind==='longitude'?Number(value):Number(longitude);
    change.current(value.trim()&&(kind==='latitude'?longitude:latitude).trim()&&validCoordinates(lat,lon)?{latitude:lat,longitude:lon}:null);
  };
  return <div className="pin-confirmation">
    <button type="button" className="location-share-button" disabled={disabled||gps} onClick={()=>void locate()}>{gps?<Loader2 size={19} className="animate-spin"/>:<LocateFixed size={19}/>}<span>{gps?'Finding your current location…':'Send my current location'}</span></button>
    <p className="location-sharing-hint">Allow GPS access once. You can then move the pin to your house or gate, or tap the map to choose a different spot. This is not live location tracking.</p>
    <div className="delivery-confirm-map" ref={host} role="region" aria-label="Select your precise delivery location on the map"/>
    {(!token||tileError)&&<p className="commerce-hint">Map imagery is unavailable. GPS and manual coordinates remain available.</p>}
    {accuracy!==null&&<p className="location-accuracy" role="status">GPS accuracy: about {Math.ceil(accuracy)} metres. {accuracy>100?'Move the pin manually if needed.':'Check the pin before confirming.'}</p>}
    {point&&<p className="location-selected"><LocateFixed size={15}/> Pin selected: {point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</p>}
    {message&&<p className="commerce-hint" role="status">{message}</p>}
    <details><summary>Enter coordinates manually</summary><div className="commerce-field-grid">
      <label className="commerce-field">Latitude<input type="number" step="0.000001" min="-90" max="90" value={latitude} disabled={disabled} onChange={e=>coordinate('latitude',e.target.value)}/></label>
      <label className="commerce-field">Longitude<input type="number" step="0.000001" min="-180" max="180" value={longitude} disabled={disabled} onChange={e=>coordinate('longitude',e.target.value)}/></label>
    </div></details>
  </div>;
}
