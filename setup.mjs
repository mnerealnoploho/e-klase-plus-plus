import {randomBytes,createHash} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
const password=randomBytes(18).toString('base64url');
const key=randomBytes(48).toString('hex');
const hash=createHash('sha256').update('e-klase-plus-plus:'+password).digest('hex');
try{
  await writeFile('.env','APP_PASSWORD_HASH='+hash+'\nSESSION_KEY='+key+'\n',{flag:'wx',mode:0o600});
  console.log('Local configuration created. Keep this test-site password: '+password);
  console.log('Start with npm start, then open http://localhost:3000. The .env file is ignored by Git.');
}catch(error){if(error.code==='EEXIST')console.error('Configuration already exists. It has not been overwritten.');else throw error;}
