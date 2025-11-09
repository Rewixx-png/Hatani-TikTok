# ==============================================================================
# Copyright (C) 2021 Evil0ctal
#
# This file is part of the Douyin_TikTok_Download_API project.
#
# This project is licensed under the Apache License 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at:
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# ==============================================================================
# 　　　　 　　  ＿＿
# 　　　 　　 ／＞　　フ
# 　　　 　　| 　_　 _ l
# 　 　　 　／` ミ＿xノ
# 　　 　 /　　　 　 |       Feed me Stars ⭐ ️
# 　　　 /　 ヽ　　 ﾉ
# 　 　 │　　|　|　|
# 　／￣|　　 |　|　|
# 　| (￣ヽ＿_ヽ_)__)
# 　＼二つ
# ==============================================================================
#
# Contributor Link:
# - https://github.com/Evil0ctal
#
# ==============================================================================

import asyncio
import re
import httpx

from crawlers.douyin.web.web_crawler import DouyinWebCrawler  # 导入抖音Web爬虫
from crawlers.tiktok.web.web_crawler import TikTokWebCrawler  # 导入TikTok Web爬虫
from crawlers.tiktok.app.app_crawler import TikTokAPPCrawler  # 导入TikTok App爬虫
from crawlers.bilibili.web.web_crawler import BilibiliWebCrawler  # 导入Bilibili Web爬虫


class HybridCrawler:
    def __init__(self):
        self.DouyinWebCrawler = DouyinWebCrawler()
        self.TikTokWebCrawler = TikTokWebCrawler()
        self.TikTokAPPCrawler = TikTokAPPCrawler()
        self.BilibiliWebCrawler = BilibiliWebCrawler()

    async def get_bilibili_bv_id(self, url: str) -> str:
        """
        从 Bilibili URL 中提取 BV 号，支持短链重定向
        """
        # 如果是 b23.tv 短链，需要重定向获取真实URL
        if "b23.tv" in url:
            async with httpx.AsyncClient() as client:
                response = await client.head(url, follow_redirects=True)
                url = str(response.url)
        
        # 从URL中提取BV号
        bv_pattern = r'(?:video\/|\/)(BV[A-Za-z0-9]+)'
        match = re.search(bv_pattern, url)
        if match:
            return match.group(1)
        else:
            raise ValueError(f"Cannot extract BV ID from URL: {url}")

    async def hybrid_parsing_single_video(self, url: str, minimal: bool = False):
        # 解析抖音视频/Parse Douyin video
        if "douyin" in url:
            platform = "douyin"
            aweme_id = await self.DouyinWebCrawler.get_aweme_id(url)
            data = await self.DouyinWebCrawler.fetch_one_video(aweme_id)
            data = data.get("aweme_detail")
            aweme_type = data.get("aweme_type")
        # 解析TikTok视频/Parse TikTok video
        elif "tiktok" in url:
            platform = "tiktok"
            aweme_id = await self.TikTokWebCrawler.get_aweme_id(url)

            data = await self.TikTokAPPCrawler.fetch_one_video(aweme_id)
            aweme_type = data.get("aweme_type")

            # Если не minimal, то добавляем инфу об авторе
            if not minimal and data.get("author", {}).get("sec_uid"):
                try:
                    author_sec_uid = data["author"]["sec_uid"]
                    author_profile = await self.TikTokWebCrawler.fetch_user_profile(secUid=author_sec_uid, uniqueId="")
                    user_stats = author_profile.get("userInfo", {}).get("stats", {})
                    data["author"]["follower_count"] = user_stats.get("followerCount")
                    data["author"]["total_favorited"] = user_stats.get("heartCount") # В TikTok это heartCount
                except Exception as e:
                    print(f"Could not fetch author extra stats: {e}")


        # 解析Bilibili视频/Parse Bilibili video
        elif "bilibili" in url or "b23.tv" in url:
            platform = "bilibili"
            aweme_id = await self.get_bilibili_bv_id(url)  # BV号作为统一的video_id
            response = await self.BilibiliWebCrawler.fetch_one_video(aweme_id)
            data = response.get('data', {})  # 提取data部分
            aweme_type = 0
        else:
            raise ValueError("hybrid_parsing_single_video: Cannot judge the video source from the URL.")

        if not minimal:
            return data

        url_type_code_dict = {
            0: 'video', 2: 'image', 4: 'video', 68: 'image',
            51: 'video', 55: 'video', 58: 'video', 61: 'video', 150: 'image'
        }
        url_type = url_type_code_dict.get(aweme_type, 'video')

        if platform == 'bilibili':
            result_data = {
                'type': url_type, 'platform': platform, 'video_id': aweme_id,
                'desc': data.get("title"), 'create_time': data.get("pubdate"),
                'author': data.get("owner"), 'music': None, 'statistics': data.get("stat"),
                'cover_data': {}, 'hashtags': None
            }
        else:
            result_data = {
                'type': url_type, 'platform': platform, 'video_id': aweme_id,
                'desc': data.get("desc"), 'create_time': data.get("create_time"),
                'author': data.get("author"), 'music': data.get("music"),
                'statistics': data.get("statistics"), 'cover_data': {}, 'hashtags': data.get('text_extra')
            }
        
        api_data = None
        if platform == 'douyin':
            result_data['cover_data'] = {
                'cover': data.get("video", {}).get("cover"), 'origin_cover': data.get("video", {}).get("origin_cover"),
                'dynamic_cover': data.get("video", {}).get("dynamic_cover")
            }
            if url_type == 'video':
                uri = data['video']['play_addr']['uri']
                wm_video_url_HQ = data['video']['play_addr']['url_list'][0]
                nwm_video_url_HQ = wm_video_url_HQ.replace('playwm', 'play')
                api_data = {'video_data': {'nwm_video_url_HQ': nwm_video_url_HQ}}
            elif url_type == 'image':
                no_watermark_image_list = [i['url_list'][0] for i in data['images']]
                api_data = {'image_data': {'no_watermark_image_list': no_watermark_image_list}}

        elif platform == 'tiktok':
            result_data['cover_data'] = {
                'cover': data.get("video", {}).get("cover"), 'origin_cover': data.get("video", {}).get("origin_cover"),
                'dynamic_cover': data.get("video", {}).get("dynamic_cover")
            }
            if url_type == 'video':
                api_data = {'video_data': {'nwm_video_url_HQ': data['video']['bit_rate'][0]['play_addr']['url_list'][0]}}
            elif url_type == 'image':
                no_watermark_image_list = [i['display_image']['url_list'][0] for i in data['image_post_info']['images']]
                api_data = {'image_data': {'no_watermark_image_list': no_watermark_image_list}}

        elif platform == 'bilibili':
            result_data['cover_data'] = {'cover': data.get("pic")}
            if url_type == 'video':
                cid = data.get('cid')
                if cid:
                    playurl_data = await self.BilibiliWebCrawler.fetch_video_playurl(aweme_id, str(cid))
                    video_list = playurl_data.get('data', {}).get('dash', {}).get('video', [])
                    video_url = video_list[0].get('baseUrl') if video_list else None
                    api_data = {'video_data': {'nwm_video_url_HQ': video_url}}
        
        if api_data:
            result_data.update(api_data)

        return result_data
