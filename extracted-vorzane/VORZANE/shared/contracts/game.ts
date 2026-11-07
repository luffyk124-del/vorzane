export type GameCommand =
 | {type:'createHero';name:string;className:'Warrior'|'Mage'|'Assassin'|'Archer'}
 | {type:'startBattle';mode:'cave'|'dungeon'|'tower'|'hard'}
 | {type:'claimQuest';questId:string}|{type:'buyItem';itemId:string}|{type:'sellItem';itemId:string}
 | {type:'equipItem';itemId:string}|{type:'unequipItem';slot:string}|{type:'buyPet';petId:string}
 | {type:'setPet';petId:string|null}|{type:'beginExpedition';planId:string}
 | {type:'updateSettings';settings:Record<string,unknown>}|{type:'setProfileAvatar';avatarId:string}|{type:'dismissReport';id:string};
export type GameStateResponse={state:unknown;updatedAt:string};
export type AuthMeResponse={user:null|{id:string;email:string|null;isAnonymous:boolean;role:string}};
