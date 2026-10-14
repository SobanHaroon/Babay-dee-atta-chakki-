import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMapboxFeature, forwardMapbox, reverseMapbox, drivingRoute, deliveryFeeForRoute, validCoordinates } from '../src/lib/mapbox.js';
import { detectDeviceLocation } from '../src/lib/geolocation.js';

const feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [73.01, 33.68] }, properties: { mapbox_id: 'address.1', feature_type: 'address', name: '14-B Street 25', full_address: '14-B Street 25, F-10/2, Islamabad, Pakistan', place_formatted: 'F-10/2, Islamabad, Pakistan', coordinates: { longitude: 73.01, latitude: 33.68, accuracy: 'rooftop' }, context: { address: { address_number: '14-B', street_name: 'Street 25' }, neighborhood: { name: 'F-10/2' }, locality: { name: 'Islamabad Urban' }, place: { name: 'Islamabad' }, postcode: { name: '44000' }, country: { name: 'Pakistan' } } } };
test('extracts returned house, street, subsector, town and postcode without losing coordinates', () => {
  const p = parseMapboxFeature(feature)!;
  assert.equal(p.details.houseNumber, '14-B'); assert.equal(p.details.street, 'Street 25');
  assert.equal(p.details.sector, 'Sector F-10/2'); assert.equal(p.details.town, 'Islamabad Urban');
  assert.equal(p.details.postcode, '44000'); assert.equal(p.lat, 33.68); assert.equal(p.lng, 73.01);
  assert.ok(p.formatted.includes('44000')); assert.ok(p.formatted.includes('14-B'));
});
test('missing details remain empty and distant cities are never labelled Rawalpindi', () => {
  const p = parseMapboxFeature({ geometry: { coordinates: [67, 24] }, properties: { name: 'Karachi', feature_type: 'place' } })!;
  assert.equal(p.city, 'Karachi'); assert.equal(p.area, ''); assert.equal(p.details.houseNumber, '');
  assert.equal(parseMapboxFeature({ geometry: { coordinates: [999, 33] } }), null);
  assert.equal(validCoordinates(Infinity, 73), false);
});
test('Mapbox requests use longitude first, permanent storage, local bias and preserve reverse pin separately', async t => {
  const urls: URL[] = [];
  t.mock.method(globalThis, 'fetch', async (url: URL) => { urls.push(url); return Response.json({ features: [feature] }); });
  await forwardMapbox('House 14-B Street 25', 'pk.test');
  assert.equal(urls[0].searchParams.get('country'), 'pk');
  assert.equal(urls[0].searchParams.get('permanent'), 'true');
  assert.equal(urls[0].searchParams.get('proximity'), '73.1044791,33.567341');
  await reverseMapbox(33.681234, 73.011234, 'pk.test');
  assert.equal(urls[1].searchParams.get('latitude'), '33.681234');
  assert.equal(urls[1].searchParams.get('longitude'), '73.011234');
});
test('route metres and fees agree at short distances and delivery boundaries', async t => {
  t.mock.method(globalThis, 'fetch', async (url: URL) => {
    assert.ok(url.pathname.includes('73.10451,33.567348;73.08,33.585'));
    return Response.json({ code: 'Ok', routes: [{ distance: 45000.1, duration: 601, geometry: { coordinates: [[73.10451, 33.567348], [73.08, 33.585]] } }] });
  });
  const route = await drivingRoute(33.567348, 73.104510, 33.585, 73.08, 'pk.test');
  assert.ok(Math.abs(route.distanceKm - 45.0001) < 1e-8); assert.ok(route.distanceKm > 45);
  assert.equal(route.durationMinutes, 11); assert.equal(route.routeCoordinates[1].lat, 33.585);
  assert.equal(deliveryFeeForRoute(0.1, 50), 50); assert.equal(deliveryFeeForRoute(3.25, 50), 163);
  assert.throws(() => deliveryFeeForRoute(NaN, 50));
});
test('no route, rejected token and invalid coordinates never produce invented fees', async t => {
  let unauthorized = false;
  t.mock.method(globalThis, 'fetch', async () => unauthorized ? new Response('', { status: 401 }) : Response.json({ code: 'NoRoute', routes: [] }));
  await assert.rejects(drivingRoute(33.5, 73.1, 33.6, 73.2, 'pk.test'), /No driving route/);
  await assert.rejects(drivingRoute(999, 73.1, 33.6, 73.2, 'pk.test'), /Invalid/);
  unauthorized = true;
  await assert.rejects(forwardMapbox('Rawalpindi', 'pk.test'), /401/);
});
test('device location waits for an accurate fix and clears its watch', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let cleared = false;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    watchPosition(success: any, _error: any, options: any) {
      assert.equal(options.enableHighAccuracy, true); assert.equal(options.maximumAge, 0);
      queueMicrotask(() => { success({ coords: { latitude: 33.5, longitude: 73.1, accuracy: 500 } }); success({ coords: { latitude: 33.51, longitude: 73.11, accuracy: 12 } }); }); return 7;
    }, clearWatch(id: number) { assert.equal(id, 7); cleared = true; }
  } } });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'navigator', original); });
  const location = await detectDeviceLocation(); assert.equal(location.coords.accuracy, 12); assert.equal(cleared, true);
});
test('denied device permission rejects without substituting a store or IP location', async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let cleared = false;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
    watchPosition(_success: any, error: any) { queueMicrotask(() => error({ code: 1 })); return 8; }, clearWatch() { cleared = true; }
  } } });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'navigator', original); });
  await assert.rejects(detectDeviceLocation(), /permission is blocked/); assert.equal(cleared, true);
});

test('legacy freeform routing proxy is removed',async()=>{
 const {default:app}=await import('../api/index.js');const server=app.listen(0,'127.0.0.1');await new Promise<void>(resolve=>server.once('listening',resolve));
 try{const response=await fetch('http://127.0.0.1:'+(server.address() as any).port+'/api/delivery/calculate-route',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:33.5,lng:73.1})});assert.equal(response.status,404);}
 finally{await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
