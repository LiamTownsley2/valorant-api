import { load } from 'cheerio';
import axios from 'axios';
import { v5 } from 'uuid';

const TRACKER_URL = 'https://tracker.gg/valorant/profile/riot';

export type RankType =
    "Iron" |
    "Bronze" |
    "Silver" |
    "Gold" |
    "Platinum" |
    "Diamond" |
    "Ascendant" |
    "Immortal" |
    "Radiant";

export interface StatData {
    name: string;
    value: string;
}

export interface UserRank {
    name: RankType;
    ranking?: string;
}

export interface AgentData {
    name: string;
    time_played: string;
    win_percent: string;
    kd_ratio: string;
    average_damage: string;
    average_combat_score: string;
    average_damage_delta: string;
}

export interface Weapon {
    name: string;
    type: string;
    hits_breakdown: {
        head: string;
        body: string;
        legs: string;
    }
    kills: string;
}

export interface Map {
    name: string;
    wins: number;
    losses: number;
}

export interface AccuracyData {
    hits_breakdown: {
        head: {
            hits: number;
            percentage: string;
        };
        body: {
            hits: number;
            percentage: string;
        };
        legs: {
            hits: number;
            percentage: string;
        };
    }

}

export interface UserData {
    uid: string;
    username: string;
    avatar_url: string;
    current_season?: {
        rank: string;
        rating?: string;
        top_agents: AgentData[];
        playtime: string;
        stats: StatData[];
        matches_played?: string;
    };
    peak_season: {
        rank: string;
        rating?: string;
    }
    // playtime?: string;
    matches: string;
    tracker_score: {
        score: number;
        max: number;
    };
}

function parseTrackerPage(username: string, UID_NAMESPACE: string, page_html: string) {
    const $ = load(page_html);

    const segmented = $('.segment-stats');
    const playtime = segmented.find('.playtime').text().trim();
    const matches = segmented.find('.matches').text().trim();

    const ranks: UserRank[] = [];
    let isRanked = false;
    $('div.rating-entry > div.rating-entry__rank > div.flex-row > div.rating-entry__rank-info').each((index, el) => {
        const $element = $(el);

        let name: any = $element.find('div.value').text().replace(/\d+(?:,\d+)*RR/g, '').trim() as RankType;
        if (name == '') name = undefined;
        if (!name) name = $element.find('div.label').text().trim() as RankType;
        
        let mmr: any = $element.find('div.value').text().replace(name, '').trim();
        if (!mmr || mmr == '') mmr = undefined;
        
        console.log({ name, mmr });
        ranks.push({ name, ranking: mmr });

        // if (index == 0) { // IF CURRENT RANK
        //     let name = $element.find('div.label').text().replace(/\d+RR/g, '').trim() as RankType;
        //     let mmr;
        //     if (name.toLowerCase() == 'rating') { // IF NOT RATED
        //         name = $element.find('div.value').text().trim() as RankType;
        //         mmr = undefined;
        //     } else {
        //         isRanked = true;
        //         mmr = $element.find('span.mmr').text().trim();
        //     }
        //     ranks.push({ name, ranking: mmr });
        // } else if (index == 1) { // IF PEAK RANK
        //     let name = $element.find('div.value').text().replace(/\d+RR/g, '').trim() as RankType;
        //     let rank;
        //     if (name.toLowerCase().startsWith('immortal') || name.toLowerCase().startsWith('radiant')) { // IF RATED
        //         rank = $element.find('span.mmr').text().trim()
        //     } else {
        //         rank = undefined;
        //     }
        //     ranks.push({ name, ranking: rank })
        // }
    });

    if (!ranks) throw Error('Unable to gather all information.');

    const [trackerScore, trackerScoreMax] = $('.score__container > div.score__text > div.value').text().split('/').map(x => x.trim());

    const topAgentRow = $("#app > div.trn-wrapper > div.trn-container > div > main > div.content.no-card-margin > div.site-container.trn-grid.trn-grid--vertical.trn-grid--small > div.trn-grid.container > div.area-main > div.top-agents.area-top-agents > div > div > div.st-content > div");
    const items = topAgentRow.find('div.st-content__item');
    const top_agents: AgentData[] = [];
    items.each((index, element) => {
        const $element = $(element);
        const _info = $element
            .find('div.value')
            .toArray()
            .map(x => $(x).text());

        if (!_info) throw Error('Unable to gather all information.');
        top_agents[index] = {
            name: _info[0],
            time_played: _info[1],
            win_percent: _info[2],
            kd_ratio: _info[3],
            average_damage: _info[4],
            average_combat_score: _info[5],
            average_damage_delta: _info[6]
        }
    });

    if (!ranks) return;
    const _curRank = ranks[0].name;
    const _curRating = ranks[0].ranking;
    const _peakRank = ranks[1].name;
    const _peakRating = ranks[1].ranking;
    if (!_curRank || !_peakRank) {
        throw Error('Unanable to gather all information.')
    }


    const main = $('div.main');
    let mainData: StatData[] = [];

    const _info = main.find('div.stat > div.wrapper > div.numbers');
    _info.each((index, element) => {
        const _name = $(element).find('.name').text()
        const _value = $(element).find('.value').text()
        mainData.push({ name: _name, value: _value });
    })

    const giantStats = $('.giant-stats')
    const _giantStats = giantStats.find('div.stat > div.wrapper > div.numbers');
    _giantStats.each((index, element) => {
        const _name = $(element).find('.name').text()
        const _value = $(element).find('.value').text()
        mainData.push({ name: _name, value: _value });
    })

    const avatar_url = $('.user-avatar').find('.user-avatar__image').attr('src')
    if (!avatar_url) {
        throw Error('Unanable to gather all information.')
    }

    const _data: UserData = {
        uid: v5(username, UID_NAMESPACE),
        username,
        avatar_url: avatar_url,
        // playtime,
        matches,
        current_season: {
            playtime,
            rank: _curRank,
            rating: _curRating,
            stats: mainData,
            top_agents,
        },
        peak_season: {
            rank: _peakRank,
            rating: _peakRating,
        },
        tracker_score: {
            score: parseInt(trackerScore),
            max: parseInt(trackerScoreMax)
        },
    };

    return _data;
}

export async function getProfileInfo(usernames: string[], UID_NAMESPACE: string) {
    let _finalData: UserData[] = [];
    for (const username of usernames) {
        const res = await axios({
            method: 'GET',
            url: `${TRACKER_URL}/${encodeURIComponent(username)}/overview`
        })
        const _data = parseTrackerPage(username, UID_NAMESPACE, res.data)
        if (!_data) return undefined;
        _finalData.push(_data);
    }
    return _finalData;
}

(async () => {
    const profile = await getProfileInfo(['PAIN#1VCT', 'Lord Gargamel#1000'], '4f8cc129-fc8e-47fd-ba7a-79638a875d2f') as any;
    console.log(profile);
    // console.log('Final: ', profile[0].current_season.rating);
    // console.log('current_season ->', profile[0].current_season);
})()