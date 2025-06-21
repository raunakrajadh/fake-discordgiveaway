const express = require('express');
const app = express();
app.get('/', (req, res) => res.send('hello world'));
app.listen(3000 || process.env.PORT, () => console.log('Server running.'));

const mongoose = require('mongoose');
const {
  Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder,
  ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder,
  PermissionsBitField, ActivityType
} = require('discord.js');

const Giveaway = require('./models/giveaway');
const config = require('./config.json');

mongoose.connect(config.mongoUri).then(() => console.log('Connected to MongoDB'));
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.once('ready', async () => {
  console.log(`Logged in as ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: 'Hosting Giveaways!', type: ActivityType.Custom}],
    status: 'online'
  });

  const activeGiveaways = await Giveaway.find({ endTime: { $gt: Date.now() } });
  activeGiveaways.forEach(g => setTimeout(() => endGiveaway(g), g.endTime - Date.now()));

  await client.application.commands.create(
    new SlashCommandBuilder()
      .setName('create-giveaway')
      .setDescription('Creates a giveaway')
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  );
});

client.on('interactionCreate', async interaction => {
  if (interaction.isCommand() && interaction.commandName === 'create-giveaway') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'You do not have permission!', ephemeral: true });
    }

    const modal = new ModalBuilder().setCustomId('createGiveawayModal').setTitle('Create Giveaway');

    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('description')
          .setLabel('Description')
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('durationInput')
          .setLabel('Duration (e.g. "1 day, 2 hours, 5 mins")')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setValue('1 day')
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('winnerUserId')
          .setLabel('Winner Message')
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId === 'createGiveawayModal') {
    const durationInput = interaction.fields.getTextInputValue('durationInput');
    const description = interaction.fields.getTextInputValue('description');
    const winnerUserId = interaction.fields.getTextInputValue('winnerUserId');

    const durationMs = parseDurationInput(durationInput);
    if (!durationMs) {
      return interaction.reply({ content: 'Invalid duration format. Example: "1 day, 2 hours, 5 mins"', ephemeral: true });
    }

    const endTime = Date.now() + durationMs;

    const embed = new EmbedBuilder().setTitle(`New Giveaway for ${interaction.guild.name}`).setDescription(description).setFooter({ text: "Entries: 0" });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('enterGiveaway').setLabel('Enter Giveaway').setStyle(ButtonStyle.Primary)
    );

    const giveawayMessage = await interaction.channel.send({ embeds: [embed], components: [row] });

    const g = await Giveaway.create({
      messageId: giveawayMessage.id,
      channelId: interaction.channel.id,
      description,
      endTime,
      winnerUserId,
      participants: []
    });

    setTimeout(() => endGiveaway(g), durationMs);

    await interaction.reply({ content: 'Giveaway created!', ephemeral: true });
  }

  if (interaction.isButton() && interaction.customId === 'enterGiveaway') {
    const g = await Giveaway.findOne({ messageId: interaction.message.id });
    if (!g) return interaction.reply({ content: 'Giveaway not found.', ephemeral: true });

    if (g.participants.includes(interaction.user.id)) {
      return interaction.reply({ content: 'You have already entered!', ephemeral: true });
    }

    await Giveaway.updateOne(
      { messageId: g.messageId },
      { $addToSet: { participants: interaction.user.id } }
    );
    const updated = await Giveaway.findOne({ messageId: g.messageId });
    const message = await interaction.channel.messages.fetch(g.messageId);
    const newEmbed = EmbedBuilder.from(message.embeds[0]).setFooter({ text: `Entries: ${updated.participants.length}` });

    await message.edit({ embeds: [newEmbed] });
    await interaction.reply({ content: 'You have successfully entered!', ephemeral: true });
  }
});

function parseDurationInput(input) {
  const units = {
    day: 86400000, days: 86400000,
    hour: 3600000, hours: 3600000,
    minute: 60000, minutes: 60000, min: 60000, mins: 60000,
    second: 1000, seconds: 1000, sec: 1000, secs: 1000
  };
  let totalMs = 0;
  try {
    const parts = input.split(',').map(p => p.trim());
    for (const part of parts) {
      const [numStr, unitStr] = part.split(/\s+/);
      const num = parseInt(numStr);
      if (isNaN(num) || !units[unitStr?.toLowerCase()]) return null;
      totalMs += num * units[unitStr.toLowerCase()];
    }
    return totalMs;
  } catch {
    return null;
  }
}

async function endGiveaway(g) {
  const channel = await client.channels.fetch(g.channelId).catch(() => null);
  if (!channel) return;

  const message = await channel.messages.fetch(g.messageId).catch(() => null);
  if (!message) return;

  const winnerUserId = g.winnerUserId; // predetermined winner
  const newEmbed = EmbedBuilder.from(message.embeds[0]).addFields({ name: 'Winner', value: `<@${winnerUserId}>` });

  await message.edit({ embeds: [newEmbed], components: [] });
  await message.reply(`<@${winnerUserId}> won the giveaway! 🎉`);

  await Giveaway.deleteOne({ _id: g._id });
}

client.login(config.token);
