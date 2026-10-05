import React,{useEffect,useRef,useState} from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {LocateFixed,Loader2} from 'lucide-react';
import {validCoordinates} from '../lib/mapbox';
import type {DeliveryPoint} from '../lib/deliveryCheckout';

export function DeliveryPinConfirm({point,onChange,disabled=false}:{point:DeliveryPoint|null;onChange:(p:DeliveryPoint|null)=>void;disabled?:boolean}) {
  const host=useRef<HTMLDivElement>(null),map=useRef<L.Map|null>(null),marker=useRef<L.Marker|null>(null),change=useRef(onChange),alive=useRef(true),busy=useRef(disabled),gpsEpoch=useRef(0);
  change.current=onChange;busy.current=disabled;
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  const [tileError,setTileError]=useState(false);
  const [gps,setGps]=useState(false),[message,setMessage]=useState(''),[latitude,setLatitude]=useState(String(point?.latitude??'')),[longitude,setLongitude]=useState(String(point?.longitude??''));
  const token=(import.meta.env.VITE_MAPBOX_ACCESS_TOKEN||import.meta.env.VITE_MAPBOX_TOKEN||'').trim();
  useEffect(()=>{
    if(!host.current||!point||map.current)return;
    const m=L.map(host.current,{scrollWheelZoom:false}).setView([point.latitude,point.longitude],16);map.current=m;
    if(token)L.tileLayer(`https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/512/{z}/{x}/{y}?access_token=${encodeURIComponent(token)}`,{attribution:'<a href="https://www.mapbox.com/about/maps/">© Mapbox</a> <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap</a>',tileSize:512,zoomOffset:-1,maxZoom:19,minZoom:8}).on('tileerror',()=>setTileError(true)).on('tileload',()=>setTileError(false)).addTo(m);
    const icon=L.divIcon({className:'delivery-pin-icon',html:'<span aria-hidden="true"></span>',iconSize:[28,36],iconAnchor:[14,36]});
    const p=L.marker([point.latitude,point.longitude],{draggable:true,icon,title:'Delivery pin: drag to your entrance',keyboard:true}).addTo(m);marker.current=p;
    p.on('dragstart',()=>{gpsEpoch.current++;setGps(false);change.current(null);});
    p.on('dragend',()=>{const v=p.getLatLng();change.current({latitude:v.lat,longitude:v.lng});});
    m.on('click',event=>{if(busy.current)return;gpsEpoch.current++;setGps(false);p.setLatLng(event.latlng);change.current({latitude:event.latlng.lat,longitude:event.latlng.lng});});
    const observer=new ResizeObserver(()=>m.invalidateSize());observer.observe(host.current);
    return()=>{observer.disconnect();m.remove();map.current=null;marker.current=null;};
  },[token]);
  useEffect(()=>{
    if(point){if(gps){gpsEpoch.current++;setGps(false);}setLatitude(String(point.latitude));setLongitude(String(point.longitude));marker.current?.setLatLng([point.latitude,point.longitude]);if(map.current&&!map.current.getBounds().contains([point.latitude,point.longitude]))map.current.panTo([point.latitude,point.longitude]);}
  },[point?.latitude,point?.longitude]);
  useEffect(()=>{if(disabled){map.current?.dragging.disable();marker.current?.dragging?.disable();}else{map.current?.dragging.enable();marker.current?.dragging?.enable();}},[disabled]);
  const locate=()=>{
    if(!navigator.geolocation){setMessage('Location is unavailable on this device. Adjust the map pin instead.');return;}
    const epoch=++gpsEpoch.current;setGps(true);setMessage('');onChange(null);
    navigator.geolocation.getCurrentPosition(position=>{
      if(!alive.current||epoch!==gpsEpoch.current)return;
      const p={latitude:position.coords.latitude,longitude:position.coords.longitude};onChange(p);map.current?.setView([p.latitude,p.longitude],17);
      setMessage(`Device accuracy: about ${Math.round(position.coords.accuracy)} metres. Check the pin before confirming.`);setGps(false);
    },()=>{if(!alive.current||epoch!==gpsEpoch.current)return;setGps(false);setMessage('Your device could not provide a location. Allow location access or adjust the pin manually.');},{enableHighAccuracy:true,maximumAge:0,timeout:15000});
  };
  const coordinate=(kind:'latitude'|'longitude',value:string)=>{
    gpsEpoch.current++;setGps(false);kind==='latitude'?setLatitude(value):setLongitude(value);
    const lat=kind==='latitude'?Number(value):Number(latitude),lon=kind==='longitude'?Number(value):Number(longitude);
    onChange(value.trim()&&(kind==='latitude'?longitude:latitude).trim()&&validCoordinates(lat,lon)?{latitude:lat,longitude:lon}:null);
  };
  return <div className="pin-confirmation">
    <p>Tap the map or drag the pin to your entrance, then confirm it. Your complete typed address stays with the order.</p>
    <div className="delivery-confirm-map" ref={host} role="region" aria-label="Adjust delivery location map" />
    {(!token||tileError)&&<p className="commerce-hint">Map imagery is currently unavailable. Use your device location or enter coordinates, then confirm the pin.</p>}
    <button type="button" className="commerce-back" disabled={disabled||gps} onClick={locate}>{gps?<Loader2 size={16} className="animate-spin"/>:<LocateFixed size={16}/>} {gps?'Finding your location…':'Use device location'}</button>
    <details><summary>Enter coordinates manually</summary><div className="commerce-field-grid"><label className="commerce-field">Latitude<input type="number" step="0.000001" min="-90" max="90" value={latitude} disabled={disabled} onChange={e=>coordinate('latitude',e.target.value)}/></label><label className="commerce-field">Longitude<input type="number" step="0.000001" min="-180" max="180" value={longitude} disabled={disabled} onChange={e=>coordinate('longitude',e.target.value)}/></label></div></details>
    {message&&<p className="commerce-hint" role="status">{message}</p>}
  </div>;
}
