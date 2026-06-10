fetch('https://workspace-blue-theta-87.vercel.app/').then(r=>r.text()).then(t => {
   const bundle = t.match(/src="(\/assets\/index-[^"]+\.js)"/)[1];
   fetch('https://workspace-blue-theta-87.vercel.app' + bundle).then(r=>r.text()).then(js => {
       const match = js.match(/.{0,80}\bZA\b.{0,80}/g);
       console.log('Matches:', match ? match.slice(0, 10) : 'Not found');
   })
})
