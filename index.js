require('dotenv').config();
const { Client, GatewayIntentBits, PermissionsBitField, WebhookClient, Collection, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages
  ]
});

const DATA_PATH = path.join(__dirname, 'data.json');
let pendingMessages = new Map(); // guildId -> {message: string}

function loadData() {
  try {
    const data = fs.readFileSync(DATA_PATH, 'utf8');
    const parsed = JSON.parse(data);
    pendingMessages = new Map(Object.entries(parsed));
  } catch (err) {
    console.log('No data.json or invalid, starting empty');
    pendingMessages = new Map();
  }
}

function saveData() {
  const data = Object.fromEntries(pendingMessages);
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

loadData();

const webhookClient = process.env.WEBHOOK_URL ? new WebhookClient({ url: process.env.WEBHOOK_URL }) : null;

client.commands = new Collection();

const commands = [
  {
    name: 'dm-prepare',
    description: 'Prépare un message à envoyer en DM à tous',
  },
  {
    name: 'dm-status',
    description: 'Vérifie le message en attente',
  },
  {
    name: 'dm-send',
    description: 'Envoie le message en DM à tous les membres',
  }
];

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}!`);

  // Register slash commands global
  await client.application.commands.set(commands);
  console.log('Slash commands registered!');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    return interaction.reply({ content: '❌ Admin only.', ephemeral: true });
  }

  const guildId = interaction.guild.id;

  if (interaction.commandName === 'dm-prepare') {
    const modal = new ModalBuilder()
      .setCustomId('dm_modal')
      .setTitle('Message à envoyer');

    const messageInput = new TextInputBuilder()
      .setCustomId('messageText')
      .setLabel("Votre message (max 4000 chars)")
      .setStyle(TextInputStyle.Paragraph);

    modal.addComponents(
      new ActionRowBuilder().addComponents(messageInput),
    );

    await interaction.showModal(modal);
  } else if (interaction.commandName === 'dm-status') {
    const pending = pendingMessages.get(guildId);
    if (!pending) {
      const embed = new EmbedBuilder()
        .setColor('Red')
        .setTitle('📭 Aucun message en attente')
        .setDescription('Utilisez /dm-prepare pour en définir un.');
      return interaction.reply({ embeds: [embed] });
    }
    const embed = new EmbedBuilder()
      .setColor('Yellow')
      .setTitle('📨 Message prêt')
      .setDescription(pending.message.substring(0, 2000))
      .setFooter({ text: 'Utilisez /dm-send pour envoyer.' });
    interaction.reply({ embeds: [embed] });
  } else if (interaction.commandName === 'dm-send') {
    const pending = pendingMessages.get(guildId);
    if (!pending) {
      return interaction.reply({ content: '❌ Aucun message. /dm-prepare d\'abord.', ephemeral: true });
    }

    console.log(`[START DM] User ${interaction.user.tag} started on guild ${interaction.guild.name} (${guildId}).`);

    const embed = new EmbedBuilder()
      .setColor('Blue')
      .setTitle('🚀 Envoi en cours...')
      .setDescription(`Message: ${pending.message.substring(0, 100)}...`);
    interaction.reply({ embeds: [embed] });

    try {
      const members = await interaction.guild.members.fetch();
      const nonBotMembers = members.filter(m => !m.user.bot);
      const total = nonBotMembers.size;
      console.log(`[DM PREP] ${total} targets.`);

      let sent = 0;
      let failed = 0;
      for (let i = 0; i < total; i++) {
        const member = nonBotMembers.at(i);
        try {
          await member.send(pending.message);
          sent++;
          if (sent % 10 === 0) console.log(`[PROGRESS] ${sent}/${total}`);
        } catch (e) {
          failed++;
        }
        if (i < total - 1) await new Promise(r => setTimeout(r, 1000));
      }

      console.log(`[COMPLETE] ${sent} sent, ${failed} failed.`);

      const finalEmbed = new EmbedBuilder()
        .setColor('Green')
        .setTitle('✅ Envoi terminé!')
        .addFields(
          { name: 'Envoyés', value: `${sent}`, inline: true },
          { name: 'Échecs', value: `${failed}`, inline: true },
          { name: 'Total', value: `${total}`, inline: true }
        );
      interaction.editReply({ embeds: [finalEmbed] });

      if (webhookClient) webhookClient.send(`DM blast ${interaction.guild.name}: ${sent}/${total}`);

      pendingMessages.delete(guildId);
      saveData();

    } catch (err) {
      console.error('[ERROR]', err);
      interaction.editReply('❌ Erreur envoi.');
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isModalSubmit()) return;
  if (interaction.customId === 'dm_modal') {
    const msgContent = interaction.fields.getTextInputValue('messageText');
    const guildId = interaction.guild.id;
    pendingMessages.set(guildId, { message: msgContent });
    saveData();

    console.log(`[MESSAGE SET] ${interaction.user.tag} set "${msgContent.substring(0, 50)}..." guild ${guildId}.`);

    const embed = new EmbedBuilder()
      .setColor('Green')
      .setTitle('✅ Message enregistré!')
      .setDescription(msgContent.substring(0, 2000))
      .setFooter({ text: '/dm-status ou /dm-send' });
    await interaction.reply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
