# Bot DM All

## Installation
1. Copiez `.env.example` vers `.env` et remplissez:
   ```
   DISCORD_TOKEN=votre_token_bot
   WEBHOOK_URL=optionnel_webhook_discord (pour notification)
   ```
2. `npm install`

## Utilisation
`npm start`

**Logs console détaillés:**
- [DMALL] Utilisateur/serveur/nb membres
- [MESSAGE SET] Message
- [START DM] Début
- [DM PREP] Nb cibles
- [PROGRESS] Avancement/10
- [COMPLETE] Résumé

## Slash Commands (Admin seulement)
- `/dm-prepare` → Modal pour entrer message (styler embed)
- `/dm-status` → Voir message prêt (embed)
- `/dm-send` → Envoi DM tous w/ progress logs & embed résumé

**Notes:**
- Slash global: 1h pour apparaître, ou restart Discord
- Intents activés? (Server Members + Message Content)
- Logs console détaillés

**Note:** Bot a besoin de intents GuildMembers, DM perms. Pour gros serveurs, prend du temps.
data.json persiste les messages en attente.
