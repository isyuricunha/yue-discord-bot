import { SlashCommandBuilder, EmbedBuilder } from 'discord.js'
import type { ChatInputCommandInteraction } from 'discord.js'
import { COLORS, EMOJIS } from '@yuebot/shared'

import type { Command } from './index'

// Função para buscar pokemon na PokeAPI
async function fetchPokemon(nameOrId: string) {
  try {
    // Primeiro tenta buscar pelo ID ou nome exato
    const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${nameOrId.toLowerCase()}`)

    if (!response.ok) {
      // Se não encontrar, tenta buscar todos os pokemons para fazer correspondência parcial
      const allPokemons = await fetchAllPokemons()
      const bestMatch = findBestMatch(nameOrId.toLowerCase(), allPokemons)

      if (bestMatch) {
        return fetchPokemon(bestMatch)
      }

      return null
    }

    const data = await response.json()
    return data
  } catch (error) {
    console.error('Error fetching pokemon:', error)
    return null
  }
}

// Função para buscar todos os pokemons (usada para correspondência parcial)
async function fetchAllPokemons(): Promise<string[]> {
  try {
    const response = await fetch('https://pokeapi.co/api/v2/pokemon?limit=10000')
    if (!response.ok) return []

    const data = await response.json() as { results: Array<{ name: string }> }
    return data.results.map((pokemon) => pokemon.name)
  } catch {
    return []
  }
}

// Função para encontrar a melhor correspondência parcial
function findBestMatch(input: string, pokemonList: string[]): string | null {
  if (pokemonList.includes(input)) {
    return input
  }

  // Filtra pokemons que começam com o input
  const startsWithMatches = pokemonList.filter(name =>
    name.startsWith(input)
  )

  if (startsWithMatches.length > 0) {
    // Retorna o primeiro que começa com o input
    return startsWithMatches[0]
  }

  // Filtra pokemons que contém o input
  const containsMatches = pokemonList.filter(name =>
    name.includes(input)
  )

  if (containsMatches.length > 0) {
    // Retorna o primeiro que contém o input
    return containsMatches[0]
  }

  // Filtra pokemons que são semelhantes (usando similaridade de strings)
  const similarMatches = pokemonList
    .map(name => ({
      name,
      similarity: levenshteinDistance(input, name)
    }))
    .filter(item => item.similarity <= 3) // Distância máxima de 3
    .sort((a, b) => a.similarity - b.similarity)

  if (similarMatches.length > 0) {
    return similarMatches[0].name
  }

  return null
}

// Função para calcular distância de Levenshtein (para similaridade de strings)
function levenshteinDistance(a: string, b: string): number {
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix = []

  // Inicializa a matriz
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  // Preenche a matriz
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substituição
          matrix[i][j - 1] + 1,     // inserção
          matrix[i - 1][j] + 1      // remoção
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

// Função para formatar tipos
function formatTypes(types: any): string {
  return types.map((t: any) => t.type.name).join(', ')
}

// Função para formatar habilidades
function formatAbilities(abilities: any): string {
  return abilities.map((a: any) => a.ability.name).join(', ')
}

// Função para formatar estatísticas
function formatStats(stats: any): string {
  return stats
    .map((s: any) => {
      const statName = s.stat.name.replace('special-', 'sp. ')
      return `${statName}: ${s.base_stat}`
    })
    .join('\n')
}

export const pokedexCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('pokedex')
    .setNameLocalizations({ 'pt-BR': 'pokedex' })
    .setDescription('Search for Pokémon statistics using PokeAPI')
    .setDescriptionLocalizations({ 'pt-BR': 'Busque estatísticas de Pokémon usando a PokeAPI' })
    .addStringOption(option =>
      option
        .setName('nome')
        .setNameLocalizations({ 'pt-BR': 'nome' })
        .setDescription('Pokémon name or ID')
        .setDescriptionLocalizations({ 'pt-BR': 'Nome ou ID do Pokémon' })
        .setRequired(true)
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply()

    const pokemonNameOpt = interaction.options.getString('nome', true)

    try {
      const pokemon = await fetchPokemon(pokemonNameOpt)

      if (!pokemon) {
        await interaction.editReply({
          content: `${EMOJIS.ERROR} Pokémon não encontrado. Tente outro nome ou ID.`
        })
        return
      }

      // Busca informações adicionais (species, sprites, etc.)
      const speciesResponse = await fetch((pokemon as any).species.url)
      const speciesData = await speciesResponse.json() as {
        flavor_text_entries?: Array<{ flavor_text: string; language: { name: string } }>
        genera?: Array<{ genus: string; language: { name: string } }>
        evolution_chain?: { url: string }
      }

      const flavorText = speciesData.flavor_text_entries?.find(
        (entry) => entry?.language?.name === 'en'
      )?.flavor_text || 'Sem descrição disponível.'

      // Cria embed com as informações
      const embed = new EmbedBuilder()
        .setColor(COLORS.INFO)
        .setTitle(`#${(pokemon as any).id} ${(pokemon as any).name.charAt(0).toUpperCase() + (pokemon as any).name.slice(1)}`)
        .setDescription(flavorText.replace(/\f/g, ' '))
        .setThumbnail((pokemon as any).sprites.other?.['official-artwork']?.front_default || (pokemon as any).sprites.front_default)

      // Adiciona campos básicos
      embed.addFields(
        { name: '📏 Altura', value: `${(pokemon as any).height / 10} m`, inline: true },
        { name: '📏 Peso', value: `${(pokemon as any).weight / 10} kg`, inline: true },
        { name: '🎯 Tipos', value: formatTypes((pokemon as any).types), inline: true }
      )

      // Adiciona campo de habilidades
      if ((pokemon as any).abilities.length > 0) {
        embed.addFields({
          name: '⚡ Habilidades',
          value: formatAbilities((pokemon as any).abilities),
          inline: false
        })
      }

      // Adiciona campo de estatísticas base
      if ((pokemon as any).stats.length > 0) {
        embed.addFields({
          name: '📊 Estatísticas Base',
          value: formatStats((pokemon as any).stats),
          inline: false
        })
      }

      // Adiciona campo de evoluções (simplificado)
      if (speciesData.evolution_chain?.url) {
        try {
          const evolutionResponse = await fetch(speciesData.evolution_chain.url)
          const evolutionData = await evolutionResponse.json() as {
            chain?: {
              species?: { name: string }
              evolves_to?: Array<{
                species?: { name: string }
                evolves_to?: Array<any>
              }>
            }
          }

          if (evolutionData.chain?.evolves_to?.length) {
            const evolutionNames = [evolutionData.chain.species?.name || '']
            let current = evolutionData.chain.evolves_to[0]
            while (current?.evolves_to?.length) {
              evolutionNames.push(current.species?.name || '')
              current = current.evolves_to[0]
            }
            if (evolutionNames.length > 1) {
              embed.addFields({
                name: '🔄 Evoluções',
                value: evolutionNames
                  .filter(name => name)
                  .map(name => `#${name.charAt(0).toUpperCase() + name.slice(1)}`)
                  .join(' → '),
                inline: false
              })
            }
          }
        } catch (e) {
          console.error('Error fetching evolution data:', e)
        }
      }

      // Adiciona link para mais informações
      embed.setFooter({
        text: `Mais informações: https://bulbapedia.bulbagarden.net/wiki/${(pokemon as any).name.charAt(0).toUpperCase() + (pokemon as any).name.slice(1)}`
      })

      await interaction.editReply({ embeds: [embed] })

    } catch (error) {
      console.error('Error in pokedex command:', error)
      await interaction.editReply({
        content: `${EMOJIS.ERROR} Ocorreu um erro ao buscar os dados do Pokémon. Tente novamente mais tarde.`
      })
    }
  }
}